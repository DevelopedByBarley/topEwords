const APP_URL = 'https://topwords.eu';

document.getElementById('open-ta-btn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        const url = tab?.url
            ? `${APP_URL}/text-analysis?url=${encodeURIComponent(tab.url)}`
            : `${APP_URL}/text-analysis`;
        chrome.tabs.create({ url });
    });
});
