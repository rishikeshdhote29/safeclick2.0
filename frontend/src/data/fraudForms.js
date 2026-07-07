export const FRAUD_TYPES = ['UPI Fraud', 'Phishing', 'Social Media Harassment', 'Loan App Fraud', 'Other'];

export const COMMON_FIELDS = [
  { name: 'victimName', label: 'Victim name', placeholder: 'Enter victim name' },
  { name: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
  { name: 'email', label: 'Email', placeholder: 'name@example.com', type: 'email' },
  { name: 'city', label: 'City', placeholder: 'City' },
  { name: 'state', label: 'State', placeholder: 'State' },
  { name: 'incidentDate', label: 'Incident date', type: 'date' },
];

export const FRAUD_FIELDS = {
  'UPI Fraud': [
    { name: 'transactionId', label: 'Transaction ID', placeholder: 'UPI transaction reference' },
    { name: 'recipientUpiId', label: 'UPI ID of recipient', placeholder: 'name@bank' },
    { name: 'amount', label: 'Amount', placeholder: '2500' },
    { name: 'bankName', label: 'Bank name', placeholder: 'Bank' },
    { name: 'dateTime', label: 'Date and time', placeholder: '2026-07-05 10:30' },
  ],
  Phishing: [
    { name: 'suspiciousContent', label: 'Suspicious URL / SMS / email content', placeholder: 'Paste suspicious content here', type: 'textarea' },
    { name: 'senderId', label: 'Sender ID / email / phone', placeholder: 'Sender ID' },
    { name: 'platform', label: 'Platform', placeholder: 'Email / SMS / WhatsApp / Website' },
  ],
  'Social Media Harassment': [
    { name: 'platformName', label: 'Platform name', placeholder: 'Instagram / X / Facebook' },
    { name: 'profileLink', label: 'Profile link / username', placeholder: 'Profile URL or handle' },
    { name: 'natureOfHarassment', label: 'Nature of harassment', placeholder: 'Describe the abuse', type: 'textarea' },
  ],
  'Loan App Fraud': [
    { name: 'appName', label: 'App name', placeholder: 'Loan app name' },
    { name: 'amount', label: 'Amount', placeholder: 'Amount demanded' },
    { name: 'threateningNumber', label: 'Contact number used to threaten / harass', placeholder: 'Phone number' },
  ],
  Other: [
    { name: 'description', label: 'Short description', placeholder: 'Describe the incident', type: 'textarea' },
  ],
};

