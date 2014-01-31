$(document).ready(function() {
	function init(isAPIAvailable) {
		if (isAPIAvailable) {
			// Check to see if there is an internet connection.
			$.ajax({
				type: "HEAD",
				url: "http://stats.adobe.com/",
				success: function() {
					var appView = new ADOBE.AppView(true);
				},
				
				// Display the offline messaging if unable to connect.
				error: function() {
					$("body").append("<div id='imageContainer'><img id='bgImage' src='offline.gif' width='768' height='1024'></div>");
				}
			})
		} else {
			new ADOBE.AppView(false);
		}
	}
    
	// To test on the desktop remove the JavaScript include for AdobeLibraryAPI.js.
	if (typeof adobeDPS == "undefined") // Call init() immediately. This will be the case for dev on the desktop.
		init(false); 
	else								// API is available so wait for adobeDPS.initializationComplete.
		adobeDPS.initializationComplete.addOnce(function(){ init(true) });
});