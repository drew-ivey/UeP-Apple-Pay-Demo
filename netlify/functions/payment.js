import sha256 from 'sha256';
import fetch from 'node-fetch';

export const handler = async (event, context) => {
	try {
		const { payment_key, amount, invoice, description } = JSON.parse(
			event.body
		);

		if (!payment_key) {
			return {
				statusCode: 400,
				body: JSON.stringify({ error: 'Missing payment_key' }),
			};
		}

		// Generate seed (can be random for each request)
		const seed = Math.random().toString(36).substring(2, 18); // 16-char random string

		// Grab API credentials from environment variables
		const apikey = process.env.USAEPAY_API_KEY;
		const apipin = process.env.USAEPAY_API_PIN;

		// Compute hash
		const prehash = apikey + seed + apipin;
		const apihash = 's2/' + seed + '/' + sha256(prehash);
		const authKey = Buffer.from(apikey + ':' + apihash).toString('base64');

		// Build payload
		const payload = {
			command: 'sale',
			invoice: invoice || 'demo-invoice-001',
			ponum: 'demo-po-001',
			description: description || 'Demo Product',
			comments: 'Processed via Netlify Function',
			amount: amount || '17.99',
			payment_key,
		};

		// Make request to USAePay sandbox
		const response = await fetch(
			'https://sandbox.usaepay.com/api/v2/transactions',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Basic ' + authKey,
				},
				body: JSON.stringify(payload),
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return { statusCode: response.status, body: JSON.stringify(data) };
		}

		return { statusCode: 200, body: JSON.stringify(data) };
	} catch (err) {
		console.error('Server error:', err);
		return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
	}
};
