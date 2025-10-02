import './style.css';

// ✅ Wrap ApplePaySession with safety + debug
if (window.ApplePaySession) {
	const OriginalApplePaySession = window.ApplePaySession;
	window.activeApplePaySession = null;

	window.ApplePaySession = function (version, request) {
		console.log('[ApplePay] Attempting to create new session...');

		// If an existing session is active, abort it
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

		const session = new OriginalApplePaySession(version, request);
		window.activeApplePaySession = session;

		// Debug lifecycle events
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
}

// ✅ Instantiate client with your public key
let client = new usaepay.Client('_ud00nT6N3100T93q63v8w29720f3db3qYIS6huWmB');

// ✅ Config for Apple Pay
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

// ✅ Populate product info
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

// ✅ Create Apple Pay Entry
let applePay = client.createApplePayEntry(applePayConfig);

// ✅ Check Apple Pay compatibility
applePay
	.checkCompatibility()
	.then(() => {
		applePay.addButton();
	})
	.catch(() => {
		document.getElementById('applePayContainer').style.display = 'none';
	});

// ✅ Success Handler
applePay.on('applePaySuccess', function () {
	client
		.getPaymentKey(applePay)
		.then((result) => paymentKeyHandler(result))
		.catch((res) => {
			console.error('CATCH: ', res);
			document.getElementById('paymentCardErrorContainer').innerText =
				'Payment error: ' + res.message;
		});
});

// ✅ Error Handler
applePay.on('applePayError', function () {
	document.getElementById('paymentCardErrorContainer').innerText =
		'Apple Pay failed. Please try again.';
});

// ✅ Send payment token to backend
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
