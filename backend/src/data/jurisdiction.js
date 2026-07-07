const HELPLINE_1930 = {
  label: 'National Cyber Crime Helpline',
  phone: '1930',
  telLink: 'tel:1930',
  website: 'https://cybercrime.gov.in',
};

const JURISDICTION_DATA = {
  Delhi: {
    default: {
      cyberCell: 'Delhi Cyber Police Station (Placeholder)',
      phone: '+91 11 2345 6789',
      email: 'cybercell.delhi@example.gov.in',
      address: 'New Delhi, India',
    },
  },
  Maharashtra: {
    default: {
      cyberCell: 'Maharashtra Cyber Crime Cell (Placeholder)',
      phone: '+91 22 2987 6543',
      email: 'cybercell.maharashtra@example.gov.in',
      address: 'Mumbai, Maharashtra',
    },
  },
  Karnataka: {
    default: {
      cyberCell: 'Karnataka Cyber Crime Station (Placeholder)',
      phone: '+91 80 4000 1234',
      email: 'cybercell.karnataka@example.gov.in',
      address: 'Bengaluru, Karnataka',
    },
  },
  Telangana: {
    default: {
      cyberCell: 'Telangana Cyber Crime Wing (Placeholder)',
      phone: '+91 40 2345 6780',
      email: 'cybercell.telangana@example.gov.in',
      address: 'Hyderabad, Telangana',
    },
  },
  'Tamil Nadu': {
    default: {
      cyberCell: 'Tamil Nadu Cyber Crime Cell (Placeholder)',
      phone: '+91 44 2500 9000',
      email: 'cybercell.tamilnadu@example.gov.in',
      address: 'Chennai, Tamil Nadu',
    },
  },
};

function getJurisdiction(state, fraudType) {
  const stateEntry = JURISDICTION_DATA[state] || {};
  const resolved = stateEntry[fraudType] || stateEntry.default || {
    cyberCell: 'Nearest District Cyber Cell (Placeholder)',
    phone: '+91 0000 000000',
    email: 'cybercell.placeholder@example.gov.in',
    address: 'Replace with verified local cyber cell details',
  };

  return {
    ...resolved,
    fraudType,
    state,
    disclaimer: 'Placeholder contact data for hackathon demo only. Verify with official sources before use.',
    helpline: HELPLINE_1930,
  };
}

module.exports = getJurisdiction;
