// Listen for installation
chrome.runtime.onInstalled.addListener(function() {
  // Initialize storage
  chrome.storage.local.get(['papers'], function(result) {
    if (!result.papers) {
      chrome.storage.local.set({papers: []});
    }
  });
}); 