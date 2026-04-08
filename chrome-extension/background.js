const APP_URL = 'http://localhost:8000/text-analysis';

chrome.action.onClicked.addListener((tab) => {
    const url = `${APP_URL}?url=${encodeURIComponent(tab.url)}`;
    chrome.tabs.create({ url });
});
