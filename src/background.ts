chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
  // The API is unavailable in older browsers; the manifest still remains valid.
});
