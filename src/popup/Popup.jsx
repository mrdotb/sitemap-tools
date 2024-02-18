import { useState, useEffect } from 'react'

import './Popup.css'

function fetchActiveTabUrl() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError));
      } else if (tabs.length > 0) {
        var currentTab = tabs[0]; // there will be only one in this array
        resolve(currentTab.url);
      } else {
        reject(new Error("No active tab found"));
      }
    });
  });
}

function getRootUrl(url) {
  const parsedUrl = new URL(url);
  return `${parsedUrl.protocol}//${parsedUrl.hostname}`;
}

function getFileName(url) {
  const parsedUrl = new URL(url);
  return `${parsedUrl.hostname}-sitemap.csv`;
}

async function fetchXML(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.text();
}

function parseXML(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");
  const parseError = xmlDoc.getElementsByTagName("parsererror");
  if (parseError.length) {
    throw new Error("Error parsing XML");
  }
  return xmlDoc;
}

async function extractSitemapUrls(sitemapUrl) {
  const sitemapXML = await fetchXML(sitemapUrl).then(parseXML);
  const locs = sitemapXML.querySelectorAll("url loc")
  return Array.from(locs).map(loc => [sitemapUrl, loc.textContent])
}

function arrayToCSV(data) {
  return data.flat().map(row => {
    return row.map(item => {
      const str = typeof item === 'string' ? item : item.toString();
      const escaped = str.includes(',') || str.includes('\n') || str.includes('"')
        ? `"${str.replace(/"/g, '""')}"` // Double up quotes if present
        : str;
      return escaped;
    }).join(',');
  }).join('\n')
}


function downloadCSV(csvString, filename = 'data.csv') {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function downloadAsCsv() {
  const activeUrl = await fetchActiveTabUrl();
  const rootSitemapUrl = getRootUrl(activeUrl) + '/sitemap.xml'
  const rootSitemapXML = await fetchXML(rootSitemapUrl).then(parseXML)
  const sitemaps = rootSitemapXML.querySelectorAll("sitemap")
  const sitemapUrls = Array.from(sitemaps).map(sitemap => {
    return sitemap.querySelector('loc').textContent;
  })

  const locs = rootSitemapXML.querySelectorAll("url loc")
  const rootResult = Array.from(locs).map(loc => [sitemapUrl, loc.textContent])
  const results = await Promise.all(sitemapUrls.map(extractSitemapUrls))
  const csvString = arrayToCSV([[['sitemap', 'url']], rootResult, ...results])
  downloadCSV(csvString, getFileName(activeUrl))
}

export const Popup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const link = 'https://github.com/mrdotb/sitemap-tools'

  const download = async () => {
    try {
      setIsLoading(true); // Start loading
      setError(''); // Reset error state
      await downloadAsCsv()
    } catch (error) {
      setError('Failed to download sitemap as CSV.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main>
      <h3>Sitemap Tools</h3>
      <div className="calc">

        <button onClick={download} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Download Sitemap as CSV'}
        </button>

        {error && <p>{error}</p>}

      </div>
      <a href={link} target="_blank">
        Source code
      </a>
    </main>
  )
}

export default Popup
