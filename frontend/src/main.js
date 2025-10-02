import './style.css';
// Store the original ApplePaySession
const OriginalApplePaySession = window.ApplePaySession;

// Track the active session globally
window.activeApplePaySession = null;

// Override ApplePaySession constructor
window.ApplePaySession = function (version, request) {
	console.log('[ApplePay] Attempting to create new session...');

	// If there's already a session, abort it
	if (window.activeApplePaySession) {
		try {
			console.warn(
				'[ApplePay] Aborting existing session before creating a new one'
			);
			window.activeApplePaySession.abort();
		} catch (err) {
			console.error('[ApplePay] Failed to abort existing session:', err);
		}
	}

	// Create a new real session
	const session = new OriginalApplePaySession(version, request);

	// Track it as the active session
	window.activeApplePaySession = session;

	// Attach debug lifecycle listeners
	session.oncancel = (event) => {
		console.log('[ApplePay] Session canceled:', event);
		window.activeApplePaySession = null;
	};
	session.onabort = (event) => {
		console.log('[ApplePay] Session aborted:', event);
		window.activeApplePaySession = null;
	};
	session.onerror = (event) => {
		console.error('[ApplePay] Session error:', event);
		// Don’t clear yet — let dev inspect if it hangs
	};
	session.onvalidatemerchant = (event) => {
		console.log('[ApplePay] Merchant validation triggered:', event);
	};
	session.onpaymentauthorized = (event) => {
		console.log('[ApplePay] Payment authorized:', event);
	};
	session.onpaymentmethodselected = (event) => {
		console.log('[ApplePay] Payment method selected:', event);
	};

	return session;
};

// instantiate client with your public key
let client = new usaepay.Client('_ud00nT6N3100T93q63v8w29720f3db3qYIS6huWmB');

let applePayConfig = {
	targetDiv: 'applePayContainer',
	displayName: 'Capsule Corp.',
	paymentRequest: {
		lineItems: [
			{ label: 'Shipping', amount: '5.00', type: 'final' },
			{ label: 'Subtotal', amount: '54.99', type: 'final' },
			{ label: 'Tax', amount: '5.49', type: 'final' },
		],
		total: {
			label: 'Capsule Corp.',
			amount: '60.48',
			type: 'final',
		},
		countryCode: 'US',
		currencyCode: 'USD',
	},
};

// Populate the product info card
const lineItemsContainer = document.getElementById('lineItems');
const totalAmountEl = document.getElementById('totalAmount');

applePayConfig.paymentRequest.lineItems.forEach((item) => {
	const li = document.createElement('li');
	li.className = 'flex justify-between text-gray-700';
	li.innerHTML = `
    <span>${item.label}</span>
    <span>$${parseFloat(item.amount).toFixed(2)}</span>
  `;
	lineItemsContainer.appendChild(li);
});

totalAmountEl.textContent = `$${parseFloat(
	applePayConfig.paymentRequest.total.amount
).toFixed(2)}`;

// Instantiate ApplePay Entry
let applePay = client.createApplePayEntry(applePayConfig);

// Check Apple Pay compatibility
applePay
	.checkCompatibility()
	.then(() => {
		// show button if compatible
		applePay.addButton();
	})
	.catch(() => {
		document.getElementById('applePayContainer').style.display = 'none';
	});

// Listen for successful Apple Pay completion
applePay.on('applePaySuccess', function () {
	client
		.getPaymentKey(applePay)
		.then((result) => {
			paymentKeyHandler(result);
		})
		.catch((res) => {
			console.error('CATCH: ', res);
			document.getElementById('paymentCardErrorContainer').innerText =
				'Payment error: ' + res.message;
		});
});

// Listen for Apple Pay errors
applePay.on('applePayError', function () {
	document.getElementById('paymentCardErrorContainer').innerText =
		'Apple Pay failed. Please try again.';
});

// Insert token into form and submit
function paymentKeyHandler(token) {
	console.log('Sending payment key to backend:', token);

	const totalAmount = applePayConfig.paymentRequest.total.amount;

	fetch('/api/payment', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			payment_key: token,
			amount: totalAmount,
			invoice: '101',
			description: 'Woolen Socks',
		}),
	})
		.then(async (res) => {
			let data = await res.json();
			if (res.ok) {
				console.log('✅ Transaction approved:', data);
				alert('✅ Transaction Approved!\nTxn ID: ' + data.refnum);
			} else {
				console.error('❌ Error:', data);
				alert('❌ Transaction Failed: ' + (data.error || JSON.stringify(data)));
			}
		})
		.catch((err) => {
			console.error('⚠️ Request error:', err);
			alert('⚠️ Request failed. Check console for details.');
		});
}
