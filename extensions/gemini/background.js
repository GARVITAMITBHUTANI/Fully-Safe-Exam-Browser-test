// FSEB Gemini Extension Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('[FSEB Gemini Extension] Installed and registered with FSEB session.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ status: 'OK', agent: 'FSEB-Gemini' });
  }
  return true;
});

