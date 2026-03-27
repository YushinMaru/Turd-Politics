/**
 * researchService.js
 * Fetches Wikipedia summaries and Google News RSS articles for a debate topic.
 */

/**
 * Search Wikipedia for a summary related to the topic.
 * Uses the Wikipedia REST API — no key required.
 */
async function fetchWikipediaSummary(topic) {
  // Try to get a direct page hit first, then fall back to search
  const searchTerm = encodeURIComponent(topic.replace(/[?!]/g, '').trim());

  try {
    // Step 1: search for the best matching article title
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${searchTerm}&srlimit=1&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'TurdPoliticsBot/1.0' } });
    const searchData = await searchRes.json();

    const results = searchData?.query?.search;
    if (!results || results.length === 0) return null;

    const pageTitle = encodeURIComponent(results[0].title);

    // Step 2: get the summary for that article
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${pageTitle}`;
    const summaryRes = await fetch(summaryUrl, { headers: { 'User-Agent': 'TurdPoliticsBot/1.0' } });
    if (!summaryRes.ok) return null;

    const data = await summaryRes.json();
    return {
      title: data.title,
      summary: data.extract ? data.extract.slice(0, 800) : null,
      url: data.content_urls?.desktop?.page || null,
      thumbnail: data.thumbnail?.source || null,
    };
  } catch (err) {
    console.error('[Research] Wikipedia error:', err.message);
    return null;
  }
}

/**
 * Fetch recent news headlines from Google News RSS.
 * Returns up to `limit` articles with title + url.
 */
async function fetchNewsArticles(topic, limit = 4) {
  const query = encodeURIComponent(topic.replace(/[?!]/g, '').trim());
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(rssUrl, { headers: { 'User-Agent': 'TurdPoliticsBot/1.0' } });
    if (!res.ok) return [];

    const xml = await res.text();

    // Parse <item> blocks with simple regex — no XML library needed
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;
    const linkRegex = /<link>(.*?)<\/link>/;
    const sourceRegex = /<source[^>]*>(.*?)<\/source>/;

    const articles = [];
    let match;
    while ((match = itemRegex.exec(xml)) !== null && articles.length < limit) {
      const block = match[1];
      const titleMatch = titleRegex.exec(block);
      const linkMatch = linkRegex.exec(block);
      const sourceMatch = sourceRegex.exec(block);

      const title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : null;
      const link = linkMatch ? linkMatch[1].trim() : null;
      const source = sourceMatch ? sourceMatch[1].trim() : null;

      if (title && link) {
        articles.push({ title, url: link, source });
      }
    }

    return articles;
  } catch (err) {
    console.error('[Research] News error:', err.message);
    return [];
  }
}

/**
 * Run both lookups and return a combined research object.
 */
async function researchTopic(topic) {
  const [wiki, news] = await Promise.all([
    fetchWikipediaSummary(topic),
    fetchNewsArticles(topic),
  ]);
  return { wiki, news };
}

module.exports = { researchTopic };
