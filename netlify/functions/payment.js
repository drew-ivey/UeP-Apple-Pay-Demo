import sha256 from 'sha256';

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

		const apikey = process.env.USAEPAY_API_KEY;
		const apipin = process.env.USAEPAY_API_PIN;

		if (!apikey || !apipin) {
			return {
				statusCode: 500,
				body: JSON.stringify({ error: 'API credentials not configured' }),
			};
		}

		const seed = Math.random().toString(36).substring(2, 18); // 16-char random string
		const prehash = apikey + seed + apipin;
		const apihash = 's2/' + seed + '/' + sha256(prehash);
		const authKey = Buffer.from(`${apikey}:${apihash}`).toString('base64');

		const payload = {
			command: 'sale',
			invoice: invoice || 'demo-invoice-001',
			ponum: 'demo-po-001',
			description: description || 'Demo Product',
			comments: 'Processed via Netlify Function',
			amount: String(amount || '17.99'),
			payment_key,
		};

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
		return {
			statusCode: response.ok ? 200 : response.status,
			body: JSON.stringify(data),
		};
	} catch (err) {
		console.error('Server error:', err);
		return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
	}
};
