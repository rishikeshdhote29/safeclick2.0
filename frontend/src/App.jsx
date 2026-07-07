import { useEffect, useMemo, useState } from 'react';
import { api, downloadBlob } from './lib/api';
import { COMMON_FIELDS, FRAUD_FIELDS, FRAUD_TYPES } from './data/fraudForms';
import { extractClientMetadata, mergeMetadata, METADATA_FIELDS } from './lib/extractMetadata';

const METADATA_LABELS = {
  fileType: 'File type',
  source: 'Source',
  sourceDevice: 'Source device',
  collectedAt: 'Collected at',
  transactionId: 'Transaction ID',
  platformName: 'Platform name',
  complaintCategory: 'Complaint category',
  captureMethod: 'Capture method',
  captureLimitations: 'Capture limitations',
};

const STATUS_OPTIONS = ['submitted', 'under-review', 'forwarded', 'accepted', 'rejected', 'pending-clarification', 'package-ready'];

const LANG = {
  en: {
    title: 'SuRakshaFile',
    subtitle: 'Cyber complaint support workspace — improves complaint quality and evidence readiness for victim, NGO/support, police, and admin workflows.',
    login: 'Secure login with OTP',
    role: 'Role',
    id: 'Identifier (phone/email)',
    name: 'Display name',
    sendOtp: 'Send OTP',
    verifyOtp: 'Verify OTP',
    otpCode: 'OTP code',
    language: 'Language',
    createCase: 'Create / update complaint',
    evidenceMeta: 'Evidence metadata',
    help: 'Help and next steps',
    // noGuarantee: 'This tool does not guarantee FIR or conviction; it prepares better documentation for review.',
  },
  hi: {
    title: 'SuRakshaFile',
    subtitle: 'साइबर शिकायत सहायता वर्कस्पेस — यह सिस्टम शिकायत और साक्ष्य को बेहतर बनाता है: पीड़ित, NGO/सपोर्ट, पुलिस और एडमिन के लिए।',
    login: 'OTP के साथ सुरक्षित लॉगिन',
    role: 'भूमिका',
    id: 'पहचान (फोन/ईमेल)',
    name: 'नाम',
    sendOtp: 'OTP भेजें',
    verifyOtp: 'OTP सत्यापित करें',
    otpCode: 'OTP कोड',
    language: 'भाषा',
    createCase: 'शिकायत बनाएं / अपडेट करें',
    evidenceMeta: 'साक्ष्य मेटाडेटा',
    help: 'सहायता और अगले कदम',
    noGuarantee: 'यह टूल FIR या सज़ा की गारंटी नहीं देता; यह समीक्षा के लिए बेहतर दस्तावेज़ तैयार करता है।',
  },
};

function emptyForm() {
  return {
    victimName: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    incidentDate: '',
    formData: {},
    victimClientId: '',
  };
}

function emptyMetadata() {
  return {
    fileType: '',
    source: '',
    sourceDevice: '',
    collectedAt: '',
    transactionId: '',
    platformName: '',
    complaintCategory: '',
    captureMethod: '',
    captureLimitations:
      'Hash after upload confirms integrity post-capture. It cannot prove that evidence was unaltered before upload.',
  };
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem('suraksha-session') || 'null');
  } catch {
    return null;
  }
}

function saveSession(value) {
  localStorage.setItem('suraksha-session', JSON.stringify(value));
}

function clearSession() {
  localStorage.removeItem('suraksha-session');
}

function roleCanEditComplaint(role) {
  return ['victim', 'support', 'admin'].includes(role);
}

function roleCanUpload(role) {
  return ['victim', 'support', 'admin'].includes(role);
}

function roleCanUpdateStatus(role) {
  return ['support', 'police', 'admin'].includes(role);
}

function roleCanEditEvidenceMetadata(role) {
  return ['support', 'admin'].includes(role);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function badgeForStatus(status) {
  const map = {
    submitted: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
    'under-review': 'border-amber-400/30 bg-amber-500/10 text-amber-200',
    forwarded: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200',
    accepted: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    rejected: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
    'pending-clarification': 'border-orange-400/30 bg-orange-500/10 text-orange-200',
    'package-ready': 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
  };
  return map[status] || 'border-white/20 bg-white/5 text-slate-200';
}

export default function App() {
  const [language, setLanguage] = useState('en');
  const [loginRole, setLoginRole] = useState('victim');
  const [identifier, setIdentifier] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);

  const [fraudType, setFraudType] = useState('UPI Fraud');
  const [form, setForm] = useState(emptyForm());
  const [evidenceMeta, setEvidenceMeta] = useState(emptyMetadata());
  const [complaints, setComplaints] = useState([]);
  const [activeComplaintId, setActiveComplaintId] = useState('');
  const [activeComplaint, setActiveComplaint] = useState(null);
  const [evidences, setEvidences] = useState([]);
  const [statusUpdate, setStatusUpdate] = useState('under-review');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [statusOfficerName, setStatusOfficerName] = useState('');
  const [statusRecipientUnit, setStatusRecipientUnit] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [autoExtractedFields, setAutoExtractedFields] = useState([]);
  const [metadataExtracting, setMetadataExtracting] = useState(false);
  const [editingEvidenceId, setEditingEvidenceId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const t = LANG[language];
  const fields = useMemo(() => FRAUD_FIELDS[fraudType] || FRAUD_FIELDS.Other, [fraudType]);

  const role = user?.role || '';
  const canEditComplaint = roleCanEditComplaint(role);
  const canUpload = roleCanUpload(role);
  const canUpdateStatus = roleCanUpdateStatus(role);
  const canEditEvidenceMetadata = roleCanEditEvidenceMetadata(role);

  async function extractMetadataForFiles(files) {
    if (!files.length) {
      setAutoExtractedFields([]);
      return;
    }

    const firstFile = files[0];
    const clientMeta = extractClientMetadata(firstFile, activeComplaint);
    const merged = mergeMetadata(clientMeta, {
      ...evidenceMeta,
      complaintCategory: activeComplaint?.fraudType || fraudType || clientMeta.complaintCategory,
    });
    setEvidenceMeta(merged);
    setAutoExtractedFields(Object.keys(clientMeta).filter((key) => clientMeta[key]));

    if (!activeComplaintId || !token) {
      return;
    }

    setMetadataExtracting(true);
    try {
      const formData = new FormData();
      formData.append('file', firstFile);
      formData.append('lastModified', String(firstFile.lastModified || ''));
      formData.append('metadataJson', JSON.stringify(merged));
      const result = await api.extractEvidenceMetadata(activeComplaintId, formData, token);
      setEvidenceMeta(result.metadata);
      setAutoExtractedFields(result.autoExtracted || []);
      setMessage('Metadata auto-extracted from file. Review and upload when ready.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setMetadataExtracting(false);
    }
  }

  async function handleFilesSelected(event) {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
    await extractMetadataForFiles(files);
  }

  function loadEvidenceMetadata(item) {
    setEvidenceMeta({
      ...emptyMetadata(),
      ...(item.metadata || {}),
    });
    setAutoExtractedFields([]);
  }

  async function loadComplaints() {
    if (!token) return;
    const data = await api.listComplaints(token);
    setComplaints(data);
  }

  async function openComplaint(complaintId) {
    const detail = await api.getComplaint(complaintId, token);
    setActiveComplaintId(complaintId);
    setActiveComplaint(detail.complaint);
    setEvidences(detail.evidences || []);
    setFraudType(detail.complaint.fraudType || 'Other');
    setForm({
      ...emptyForm(),
      ...detail.complaint,
      formData: detail.complaint.formData || {},
    });
  }

  useEffect(() => {
    const session = readSession();
    if (session?.token) {
      setToken(session.token);
      api
        .getMe(session.token)
        .then((result) => setUser(result.user))
        .catch(() => {
          clearSession();
          setToken('');
          setUser(null);
        });
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadComplaints().catch((error) => setMessage(error.message));
    }
  }, [token]);

  useEffect(() => {
    if (activeComplaint?.fraudType) {
      setEvidenceMeta((current) => ({
        ...current,
        complaintCategory: current.complaintCategory || activeComplaint.fraudType,
      }));
    }
  }, [activeComplaint?.fraudType]);

  const requestOtp = async () => {
    setMessage('');
    try {
      const result = await api.requestOtp({ role: loginRole, identifier, displayName });
      setChallengeId(result.challengeId);
      setDevOtp(result.devOtp || '');
      setMessage(
        result.deliveryMethod === 'email'
          ? result.message
          : `OTP generated. ${result.devOtp ? `Dev OTP: ${result.devOtp}` : ''}`
      );
    } catch (error) {
      setMessage(error.message);
    }
  };

  const verifyOtp = async () => {
    setMessage('');
    try {
      const result = await api.verifyOtp({ challengeId, otp });
      setToken(result.token);
      setUser(result.user);
      saveSession({ token: result.token });
      setMessage('Login successful.');
      await loadComplaints();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await api.logout(token);
      }
    } catch (_) {
    } finally {
      clearSession();
      setToken('');
      setUser(null);
      setComplaints([]);
      setActiveComplaint(null);
      setActiveComplaintId('');
      setEvidences([]);
      setMessage('Logged out.');
    }
  };

  const submitComplaint = async (event) => {
    event.preventDefault();
    if (!canEditComplaint) {
      setMessage('This role can review/export only.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const payload = {
        victimName: form.victimName,
        phone: form.phone,
        email: form.email,
        city: form.city,
        state: form.state,
        fraudType,
        incidentDate: form.incidentDate,
        formData: form.formData,
        victimClientId: form.victimClientId,
      };
      const result = activeComplaintId
        ? await api.updateComplaint(activeComplaintId, payload, token)
        : await api.createComplaint(payload, token);
      setMessage(activeComplaintId ? 'Complaint updated.' : 'Complaint created.');
      await loadComplaints();
      await openComplaint(result.complaint._id);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadEvidence = async () => {
    if (!activeComplaintId) {
      setMessage('Select a complaint first.');
      return;
    }
    if (!canUpload) {
      setMessage('This role cannot upload evidence.');
      return;
    }
    if (!selectedFiles.length) {
      setMessage('Select at least one file.');
      return;
    }
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append('files', file));
    formData.append('metadataJson', JSON.stringify(evidenceMeta));
    setLoading(true);
    setMessage('');
    try {
      const result = await api.uploadEvidence(activeComplaintId, formData, token);
      setMessage(result.provenanceNotice || result.message);
      await openComplaint(activeComplaintId);
      await loadComplaints();
      setSelectedFiles([]);
      setAutoExtractedFields([]);
      setEvidenceMeta(emptyMetadata());
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateEvidenceMetadata = async (evidenceId) => {
    if (!canEditEvidenceMetadata) {
      setMessage('This role cannot edit evidence metadata.');
      return;
    }
    try {
      await api.updateEvidenceMetadata(evidenceId, { metadata: evidenceMeta }, token);
      setMessage('Evidence metadata updated.');
      await openComplaint(activeComplaintId);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const updateStatus = async () => {
    if (!canUpdateStatus || !activeComplaintId) {
      return;
    }
    try {
      await api.updateComplaintStatus(
        activeComplaintId,
        {
          status: statusUpdate,
          remarks: statusRemarks,
          officerName: statusOfficerName,
          recipientUnit: statusRecipientUnit,
        },
        token
      );
      setMessage('Status updated.');
      await openComplaint(activeComplaintId);
      await loadComplaints();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const downloadPackage = async () => {
    if (!activeComplaintId) return;
    const blob = await api.downloadPackage(activeComplaintId, token);
    downloadBlob(blob, `complaint-${activeComplaintId.slice(-6)}.pdf`);
    setMessage('Police-ready packet downloaded.');
    await openComplaint(activeComplaintId);
  };

  const downloadEvidence = async (item) => {
    const blob = await api.downloadEvidence(item._id, token);
    downloadBlob(blob, item.originalFilename);
    await openComplaint(activeComplaintId);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_35%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 lg:py-10">
        <section className="glass-card p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white md:text-4xl">{t.title}</h1>
              <p className="mt-3 max-w-3xl text-slate-300">{t.subtitle}</p>
              <p className="mt-3 text-sm text-amber-200">{t.noGuarantee}</p>
            </div>
            <div className="space-y-2">
              <label className="label-text">{t.language}</label>
              <div className="flex gap-2">
                <button className="secondary-button px-3 py-2 text-sm" type="button" onClick={() => setLanguage('en')}>
                  English
                </button>
                <button className="secondary-button px-3 py-2 text-sm" type="button" onClick={() => setLanguage('hi')}>
                  हिन्दी
                </button>
              </div>
            </div>
          </div>
        </section>

        {!token ? (
          <section className="glass-card mt-6 p-6">
            <h2 className="text-xl font-semibold text-white">{t.login}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label>
                <span className="label-text">{t.role}</span>
                <select className="input-field" value={loginRole} onChange={(e) => setLoginRole(e.target.value)}>
                  <option value="victim">victim</option>
                  <option value="support">support staff / NGO helper</option>
                  <option value="police">police officer</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <label>
                <span className="label-text">{t.id}</span>
                <input className="input-field" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
              </label>
              <label>
                <span className="label-text">{t.name}</span>
                <input className="input-field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </label>
              <div className="flex items-end gap-3">
                <button className="primary-button" type="button" onClick={requestOtp}>
                  {t.sendOtp}
                </button>
              </div>
            </div>
            {challengeId ? (
              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
                <label>
                  <span className="label-text">{t.otpCode}</span>
                  <input className="input-field" value={otp} onChange={(e) => setOtp(e.target.value)} />
                </label>
                <button className="primary-button" type="button" onClick={verifyOtp}>
                  {t.verifyOtp}
                </button>
              </div>
            ) : null}
            {devOtp ? <p className="mt-3 text-xs text-slate-400">Dev OTP: {devOtp}</p> : null}
          </section>
        ) : null}

        {token ? (
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div className="glass-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-white">{t.createCase}</h2>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200">
                      {user?.role}
                    </span>
                    <button type="button" className="secondary-button px-3 py-2 text-sm" onClick={logout}>
                      Logout
                    </button>
                  </div>
                </div>

                <form className="mt-4 space-y-4" onSubmit={submitComplaint}>
                  <div className="grid gap-4 md:grid-cols-2">
                    {COMMON_FIELDS.map((field) => (
                      <label key={field.name}>
                        <span className="label-text">{field.label}</span>
                        <input
                          type={field.type || 'text'}
                          className="input-field"
                          value={form[field.name] || ''}
                          onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                          disabled={!canEditComplaint}
                        />
                      </label>
                    ))}
                  </div>
                  {['support', 'admin'].includes(role) ? (
                    <label>
                      <span className="label-text">Victim client ID (required for support/admin create)</span>
                      <input
                        className="input-field"
                        value={form.victimClientId || ''}
                        onChange={(event) => setForm((current) => ({ ...current, victimClientId: event.target.value }))}
                        disabled={!canEditComplaint}
                      />
                    </label>
                  ) : null}
                  <label>
                    <span className="label-text">Complaint category</span>
                    <select className="input-field" value={fraudType} onChange={(e) => setFraudType(e.target.value)} disabled={!canEditComplaint}>
                      {FRAUD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-4">
                    {fields.map((field) => (
                      <label key={field.name}>
                        <span className="label-text">{field.label}</span>
                        {field.type === 'textarea' ? (
                          <textarea
                            className="input-field"
                            rows={3}
                            value={form.formData?.[field.name] || ''}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                formData: {
                                  ...(current.formData || {}),
                                  [field.name]: event.target.value,
                                },
                              }))
                            }
                            disabled={!canEditComplaint}
                          />
                        ) : (
                          <input
                            className="input-field"
                            value={form.formData?.[field.name] || ''}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                formData: {
                                  ...(current.formData || {}),
                                  [field.name]: event.target.value,
                                },
                              }))
                            }
                            disabled={!canEditComplaint}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                  <button className="primary-button" type="submit" disabled={loading || !canEditComplaint}>
                    {activeComplaintId ? 'Update complaint' : 'Create complaint'}
                  </button>
                </form>
              </div>

              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white">{t.evidenceMeta}</h3>
                <p className="mt-2 text-xs text-slate-400">
                  Select a file to auto-extract metadata (file type, source, device, capture time, category). You can review or override before upload.
                </p>
                {metadataExtracting ? <p className="mt-2 text-xs text-sky-300">Extracting metadata...</p> : null}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {METADATA_FIELDS.map((key) => (
                    <label key={key}>
                      <span className="label-text flex items-center gap-2">
                        {METADATA_LABELS[key] || key}
                        {autoExtractedFields.includes(key) ? (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200">
                            Auto
                          </span>
                        ) : null}
                      </span>
                      <input
                        className="input-field"
                        value={evidenceMeta[key] || ''}
                        onChange={(e) => {
                          setEvidenceMeta((current) => ({ ...current, [key]: e.target.value }));
                          setAutoExtractedFields((current) => current.filter((field) => field !== key));
                        }}
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <input
                    type="file"
                    multiple
                    capture="environment"
                    className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-500 file:px-4 file:py-2 file:text-white"
                    onChange={handleFilesSelected}
                    disabled={!activeComplaintId || !canUpload || metadataExtracting}
                  />
                  <button type="button" className="primary-button" disabled={!activeComplaintId || !canUpload || loading || metadataExtracting} onClick={uploadEvidence}>
                    Upload + hash + timestamp
                  </button>
                  {canEditEvidenceMetadata && editingEvidenceId ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => updateEvidenceMetadata(editingEvidenceId)}
                    >
                      Save metadata to selected evidence
                    </button>
                  ) : null}
                  <button type="button" className="secondary-button" onClick={downloadPackage} disabled={!activeComplaintId}>
                    Download police packet (PDF)
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Provenance limit: upload-time hashing does not prove original pre-upload integrity. Capture source/method notes are included for investigators.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white">Complaints</h3>
                <div className="mt-4 space-y-3">
                  {complaints.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => openComplaint(item._id)}
                      className={`w-full rounded-2xl border p-4 text-left ${activeComplaintId === item._id ? 'border-sky-400 bg-sky-500/10' : 'border-white/10 bg-slate-900/60'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-white">{item.fraudType}</strong>
                        <span className={`rounded-full border px-2 py-1 text-xs ${badgeForStatus(item.status)}`}>{item.status}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">{item.victimName}</p>
                      <p className="text-xs text-slate-400">Updated: {formatDate(item.updatedAt)}</p>
                    </button>
                  ))}
                </div>
              </div>

              {activeComplaint ? (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold text-white">Status and police handoff</h3>
                  {canUpdateStatus ? (
                    <div className="mt-4 space-y-3">
                      <select className="input-field" value={statusUpdate} onChange={(e) => setStatusUpdate(e.target.value)}>
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <input className="input-field" placeholder="Recipient unit" value={statusRecipientUnit} onChange={(e) => setStatusRecipientUnit(e.target.value)} />
                      <input className="input-field" placeholder="Officer name" value={statusOfficerName} onChange={(e) => setStatusOfficerName(e.target.value)} />
                      <textarea className="input-field" rows={2} placeholder="Remarks" value={statusRemarks} onChange={(e) => setStatusRemarks(e.target.value)} />
                      <button type="button" className="primary-button" onClick={updateStatus}>
                        Update status
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">Current status: {activeComplaint.status}</p>
                  )}
                </div>
              ) : null}

              {activeComplaint ? (
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold text-white">Evidence and custody log</h3>
                  <div className="mt-4 space-y-4">
                    {evidences.map((item) => (
                      <div key={item._id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{item.originalFilename}</p>
                            <p className="text-xs text-slate-400">SHA-256: {item.sha256Hash}</p>
                          </div>
                          <div className="flex gap-2">
                            <button className="secondary-button px-3 py-2 text-sm" type="button" onClick={() => downloadEvidence(item)}>
                              Download
                            </button>
                            {canEditEvidenceMetadata ? (
                              <button
                                className="secondary-button px-3 py-2 text-sm"
                                type="button"
                                onClick={() => {
                                  loadEvidenceMetadata(item);
                                  setEditingEvidenceId(item._id);
                                  setMessage(`Loaded metadata from ${item.originalFilename} for editing.`);
                                }}
                              >
                                Load for edit
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-slate-300">
                          {(item.custodyLog || []).slice(-5).map((entry, idx) => (
                            <p key={`${item._id}-log-${idx}`}>
                              {formatDate(entry.timestamp)} - {entry.action} by {entry.actorRole} ({entry.actor})
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white">{t.help}</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li>Helpline: Dial 1930 immediately for cyber fraud reporting.</li>
                  <li>FAQ: If upload fails, retry with stable internet and complete required metadata fields.</li>
                  <li>If complaint is pending clarification, update missing fields and re-submit evidence notes.</li>
                  <li>This is a support layer aligned to cyber-cell intake, not a replacement for official portals.</li>
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {message ? <p className="mt-6 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{message}</p> : null}
      </div>
    </main>
  );
}
