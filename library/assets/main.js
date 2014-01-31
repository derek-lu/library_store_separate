$(document).ready(function() {
	function init(isAPIAvailable) {
		new ADOBE.AppView(isAPIAvailable);
	}
	
	// To test on the desktop remove the JavaScript include for AdobeLibraryAPI.js.
	if (typeof adobeDPS == "undefined") // Call init() immediately. This will be the case for dev on the desktop.
		init(false); 
	else								// API is available so wait for adobeDPS.initializationComplete.
		adobeDPS.initializationComplete.addOnce(function(){ init(true) });
});