from flask import Flask, render_template, jsonify, request
import urllib.request
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import re
import time
import datetime
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_TTL = 300  # 5 minutes cache TTL

# In-memory cache store
cache_data = {
    "timestamp": 0,
    "items": [],
    "categories": []
}

def fetch_and_parse_feed():
    """Fetch BigQuery Release Notes RSS Atom feed and parse into structured items."""
    req = urllib.request.Request(
        FEED_URL, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    
    xml_content = urllib.request.urlopen(req, timeout=15).read()
    root = ET.fromstring(xml_content)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    parsed_items = []
    categories_set = set()
    
    entries = root.findall('atom:entry', ns)
    
    for entry in entries:
        date_str = entry.find('atom:title', ns).text if entry.find('atom:title', ns) is not None else 'Unknown Date'
        updated_iso = entry.find('atom:updated', ns).text if entry.find('atom:updated', ns) is not None else ''
        
        link_elem = entry.find('atom:link', ns)
        link = link_elem.attrib.get('href', '') if link_elem is not None else ''
        if link.startswith('/'):
            link = 'https://docs.cloud.google.com' + link
            
        entry_id = entry.find('atom:id', ns).text if entry.find('atom:id', ns) is not None else ''
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ''
        
        soup = BeautifulSoup(content_html, 'html.parser')
        
        # Check if content has <h3> section titles (Feature, Changed, Deprecated, etc.)
        h3_tags = soup.find_all('h3')
        if h3_tags:
            for idx, h3 in enumerate(h3_tags):
                category = h3.get_text(strip=True)
                categories_set.add(category)
                
                # Gather all sibling DOM nodes until the next h3 tag
                section_nodes = []
                for sibling in h3.next_siblings:
                    if sibling.name == 'h3':
                        break
                    section_nodes.append(str(sibling))
                
                sec_html = "".join(section_nodes).strip()
                sec_soup = BeautifulSoup(sec_html, 'html.parser')
                
                # Make relative hrefs absolute pointing to Google Cloud docs
                for a in sec_soup.find_all('a', href=True):
                    if a['href'].startswith('/'):
                        a['href'] = 'https://docs.cloud.google.com' + a['href']
                    a['target'] = '_blank'
                    a['rel'] = 'noopener noreferrer'
                
                sec_html_formatted = str(sec_soup)
                sec_text = sec_soup.get_text(separator=' ', strip=True)
                sec_text = re.sub(r'\s+', ' ', sec_text)
                
                # Title snippet logic (first full sentence or trimmed text)
                first_sentence = sec_text.split('.')[0].strip() if sec_text else category
                if len(first_sentence) > 130:
                    title_snippet = first_sentence[:127] + '...'
                else:
                    title_snippet = first_sentence if len(first_sentence) > 10 else f"{category}: BigQuery Update"
                
                item_id = f"{entry_id}_{idx}".replace(':', '_').replace('/', '_').replace('#', '_')
                
                # Pre-generate Tweet text draft
                tweet_intro = f"🚀 BigQuery Update [{date_str} - {category}]:\n\n"
                hashtags = "\n\n#BigQuery #GoogleCloud #DataEngineering"
                link_text = f"\n\n🔗 {link}"
                
                max_summary_length = 280 - len(tweet_intro) - len(link_text) - len(hashtags) - 3
                if max_summary_length > 20:
                    summary_snippet = sec_text[:max_summary_length] + "..." if len(sec_text) > max_summary_length else sec_text
                else:
                    summary_snippet = sec_text[:80] + "..."
                
                tweet_draft = f"{tweet_intro}{summary_snippet}{link_text}{hashtags}"
                
                parsed_items.append({
                    'id': item_id,
                    'date': date_str,
                    'updated_iso': updated_iso,
                    'category': category,
                    'title': title_snippet,
                    'link': link,
                    'html': sec_html_formatted,
                    'plain_text': sec_text,
                    'tweet_draft': tweet_draft
                })
        else:
            # Fallback if no h3 tags present in entry
            categories_set.add('General')
            sec_text = soup.get_text(separator=' ', strip=True)
            sec_text = re.sub(r'\s+', ' ', sec_text)
            
            item_id = entry_id.replace(':', '_').replace('/', '_').replace('#', '_')
            tweet_draft = f"🚀 BigQuery Update [{date_str}]:\n\n{sec_text[:120]}...\n\n🔗 {link}\n\n#BigQuery #GoogleCloud"
            
            parsed_items.append({
                'id': item_id,
                'date': date_str,
                'updated_iso': updated_iso,
                'category': 'General',
                'title': f"Release Update: {date_str}",
                'link': link,
                'html': content_html,
                'plain_text': sec_text,
                'tweet_draft': tweet_draft
            })
            
    sorted_categories = sorted(list(categories_set))
    return parsed_items, sorted_categories

@app.route('/')
def index():
    """Render the main single page dashboard."""
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    """API endpoint to retrieve release notes with caching and force refresh support."""
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()
    
    if force_refresh or not cache_data["items"] or (now - cache_data["timestamp"] > CACHE_TTL):
        try:
            items, categories = fetch_and_parse_feed()
            cache_data["items"] = items
            cache_data["categories"] = categories
            cache_data["timestamp"] = now
            cached_status = False
        except Exception as e:
            logging.error(f"Error fetching feed: {e}")
            if cache_data["items"]:
                items = cache_data["items"]
                categories = cache_data["categories"]
                cached_status = True
            else:
                return jsonify({
                    "success": False,
                    "error": f"Failed to fetch release notes feed: {str(e)}"
                }), 500
    else:
        items = cache_data["items"]
        categories = cache_data["categories"]
        cached_status = True

    # Search & Category Filtering
    category_filter = request.args.get('category', '').strip()
    search_query = request.args.get('search', '').strip().lower()
    
    filtered_items = items
    if category_filter and category_filter != 'All':
        filtered_items = [item for item in filtered_items if item['category'].lower() == category_filter.lower()]
        
    if search_query:
        filtered_items = [
            item for item in filtered_items 
            if search_query in item['title'].lower() 
            or search_query in item['plain_text'].lower() 
            or search_query in item['category'].lower()
            or search_query in item['date'].lower()
        ]

    formatted_time = datetime.datetime.fromtimestamp(cache_data["timestamp"]).strftime('%b %d, %Y %H:%M:%S UTC')
    
    return jsonify({
        "success": True,
        "cached": cached_status,
        "last_updated": formatted_time,
        "total_count": len(filtered_items),
        "categories": cache_data["categories"],
        "items": filtered_items
    })

@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "service": "BigQuery Release Notes Radar"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
