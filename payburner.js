
const PAYBURNER = {
  extensionStatus: 'NOT_CONNECTED',
  loggedIn: false,
  xrplConnectionStatus: false,
  isContentConnected: false
};

PAYBURNER.log = function( msg ) {
  console.log( new Date().toISOString() + ' payburner.js :: ' + msg);
}

window.PAYBURNER = PAYBURNER;

PAYBURNER.canMakePayment = function() {
  PAYBURNER.log('payburner api canMakePayment.  extensionStatus=' + PAYBURNER.extensionStatus + ', loggedIn=' + PAYBURNER.loggedIn +
      ', xrplConnectionStatus=' + PAYBURNER.xrplConnectionStatus);
  return PAYBURNER.extensionStatus === 'CONNECTED' && PAYBURNER.loggedIn && PAYBURNER.xrplConnectionStatus;
};

PAYBURNER.isPayburnerLoggedIn = function() {
  return PAYBURNER.loggedIn === true;
};

PAYBURNER.isPayburnerConnected = function() {
  return PAYBURNER.extensionStatus === 'CONNECTED';
};

PAYBURNER.makePayment = function(xrpAddress, xrpAmount) {
  return new Promise(function(resolve, reject) {
    if (!PAYBURNER.canMakePayment()) {
      reject({error: 'Your payburner browser extension must be logged in to perform this function.'});
      var dataObj = {messageType: 'WantPayburner', payload: {
          message: 'The page would like to make a payment.'
        }};
      var notifyEvent = new CustomEvent('WantPayburner', {detail:dataObj});
      document.dispatchEvent(notifyEvent);
      return;
    }
    var dataObj = {messageType: 'StraightPay', payload: {
        xrpAddress: xrpAddress, amount: parseInt((parseFloat(xrpAmount)*1000000).toString()).toString()
      }};
    var fetchEvent = new CustomEvent('StraightPay', {detail:dataObj});
    // get ready for a reply from the content script
    document.addEventListener('PaymentResult', function respListener(event) {
      var data = event.detail;
      PAYBURNER.log('<- straight pay: ' + JSON.stringify(data));
      resolve( data.payload );
      document.removeEventListener('PaymentResult', respListener);
    });
    PAYBURNER.log('-> straight pay: ' + JSON.stringify(dataObj));
    document.dispatchEvent(fetchEvent);
  });
};

const uuid4 = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

PAYBURNER.makePaymentWithTag = function(xrpAddress, destinationTag, xrpAmount) {
  return new Promise(function(resolve, reject) {
    if (!PAYBURNER.canMakePayment()) {
      reject({error: 'Your payburner browser extension must be logged in to perform this function.'});
      var dataObj = {messageType: 'WantPayburner', payload: {
          message: 'The page would like to make a payment.'
        }};
      var notifyEvent = new CustomEvent('WantPayburner', {detail:dataObj});
      document.dispatchEvent(notifyEvent);
      return;
    }
    var dataObj = {messageType: 'StraightPay', payload: {
        requestId: 'PaymentResult-' + uuid4(),
        xrpAddress: xrpAddress, destinationTag: destinationTag,
        amount: parseInt((parseFloat(xrpAmount)*1000000).toString()).toString()
      }};
    var fetchEvent = new CustomEvent('StraightPay', {detail:dataObj});
    // get ready for a reply from the content script
    document.addEventListener(dataObj.payload.requestId, function respListener(event) {
      var data = event.detail;
      PAYBURNER.log('<- straight pay with tag: ' + JSON.stringify(data));
      if (typeof data.payload.warn !== 'undefined') {
        //@TODO here we need to raise a jquery type notification -- please open then thingy.
        PAYBURNER.log('Weve received a warning:' + data.payload.warn);
      }
      else {
        resolve(data.payload);
        document.removeEventListener(dataObj.requestId, respListener);
      }
    });
    PAYBURNER.log('-> straight pay with tag: ' + JSON.stringify(dataObj));
    document.dispatchEvent(fetchEvent);
  });
};


PAYBURNER.connectToService = function(serverUserId, appPath) {
  return new Promise(function(resolve, reject) {
    if (!PAYBURNER.isPayburnerLoggedIn()) {
      reject({error: 'Your payburner browser extension must be logged in to perform this function.'});
      var dataObj = {messageType: 'WantPayburner', payload: {
          message: 'The page would like to connect to a service.'
        }};
      var notifyEvent = new CustomEvent('WantPayburner', {detail:dataObj});
      document.dispatchEvent(notifyEvent);
      return;
      return;
    }
    var dataObj = {messageType: 'ConnectToServiceRequest', payload: {
        serverUserId: serverUserId, appPath: appPath
      }};
    var fetchEvent = new CustomEvent('ConnectToServiceRequest', {detail:dataObj});
    // get ready for a reply from the content script
    document.addEventListener('ConnectToServiceResult', function respListener(event) {
      var data = event.detail;
      PAYBURNER.log('<- connect to service: ' + JSON.stringify(data.payload));
      resolve( data.payload );
      document.removeEventListener('ConnectToServiceResult', respListener);
    });
    PAYBURNER.log('-> connect to service');
    document.dispatchEvent(fetchEvent);
  });
};


PAYBURNER.waitUntilFinalHash = function(hash) {
  return new Promise(function(resolve) {
    var dataObj = {messageType: 'WaitUntilFinalHashRequest', payload: {
        hash: hash
      }};
    var fetchEvent = new CustomEvent('WaitUntilFinalHashRequest', {detail:dataObj});
    // get ready for a reply from the content script
    document.addEventListener('WaitUntilFinalHashResult', function respListener(event) {
      var data = event.detail;
      PAYBURNER.log('<- wait until final hash');
      resolve( data.payload );
      document.removeEventListener('WaitUntilFinalHashResult', respListener);
    });
    PAYBURNER.log('-> wait until final hash');
    document.dispatchEvent(fetchEvent);
  });
};

// -- the payburner api isi initialized.
var customAPILoaded = new CustomEvent('payburnerApiLoaded');
document.dispatchEvent(customAPILoaded);

// -- the content.js is initialized...
document.addEventListener('contentLoaded', function(event) {
  PAYBURNER.log('<- content.js loaded:' + JSON.stringify(event.detail));
  PAYBURNER.isContentConnected = true;
});

// -- the content.js is initialized...
document.addEventListener('PayburnerReady', function(event) {
  PAYBURNER.log('<- kernel connection is up:' + JSON.stringify(event.detail));
  PAYBURNER.extensionStatus = 'CONNECTED';
  var dataObj = {messageType: 'PayburnerApiIsUp', payload: {}};
  var fetchEvent = new CustomEvent('PayburnerApiIsUpNotification', {detail:dataObj});
  document.addEventListener('PayburnerApiIsUpResponse', function respListener(event) {
    PAYBURNER.log('<- payburner.js is up ack');
    document.removeEventListener('PayburnerApiIsUpResponse', respListener);
  });
  PAYBURNER.log('--> payburner.js is up ');
  document.dispatchEvent(fetchEvent);
});

document.addEventListener('XRPLConnectionStatus', function(event) {
  PAYBURNER.log('<- kernel XRPL connection status:' + JSON.stringify(event.detail));
  if (event.detail !== null) {
      PAYBURNER.xrplConnectionStatus = event.detail.state;
  }
});

// -- the content.js is initialized...
document.addEventListener('PayburnerLoggedIn', function(event) {
  PAYBURNER.log('<- logged in to payburner:' + JSON.stringify(event.detail));
  PAYBURNER.loggedIn = event.detail.loggedIn;
});
