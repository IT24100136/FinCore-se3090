import axios from 'axios';

export const auditService = {
  /**
   * Fetches full institutional compliance audit trail history from PostgreSQL.
   */
  getAuditHistory: async () => {
    try {
      const response = await axios.get('/api/audit/history');
      return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
      console.warn('Fallback to /api/reviews/history due to:', err.message);
      const fallback = await axios.get('/api/reviews/history');
      return Array.isArray(fallback.data) ? fallback.data : [];
    }
  },

  /**
   * Fetches audit trail for a single transaction.
   */
  getTransactionAuditTrail: async (transactionId) => {
    const response = await axios.get(`/api/reviews/${transactionId}/history`);
    return response.data;
  },

  /**
   * Export audit records to CSV file.
   */
  exportAuditToCsv: (records, filename = `FinCore_Audit_Trail_${new Date().toISOString().substring(0, 10)}.csv`) => {
    const headers = [
      'Timestamp (UTC)',
      'Timestamp (Local)',
      'Transaction Reference',
      'Action',
      'Previous Status',
      'New Status',
      'Amount (LKR)',
      'Sender Account / Name',
      'Recipient Account / Name',
      'Risk Score',
      'Risk Tier',
      'Primary Analyst / Actor',
      'Actor ID',
      'Secondary Approver',
      'Compliance Justification / Reason'
    ];

    const rows = [headers.join(',')];

    (records || []).forEach(r => {
      let utcTime = '';
      let localTime = '';
      try {
        const d = new Date(r.timestamp || r.decidedAt);
        if (!isNaN(d.getTime())) {
          utcTime = d.toISOString();
          localTime = d.toLocaleString();
        }
      } catch (e) {
        utcTime = r.timestamp || '';
        localTime = r.timestamp || '';
      }

      const cleanStr = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

      const row = [
        utcTime,
        cleanStr(localTime),
        cleanStr(r.referenceId || r.reference || r.txId || 'N/A'),
        cleanStr(r.action || 'REVIEW'),
        cleanStr(r.previousStatus || 'Queued'),
        cleanStr(r.newStatus || r.status || 'Decided'),
        Number(r.amount) || 0,
        cleanStr(`${r.senderName || ''} (${r.senderAccountNumber || ''})`.trim()),
        cleanStr(`${r.recipientName || ''} (${r.recipientAccountNo || ''})`.trim()),
        Number(r.riskScore) || 0,
        cleanStr(r.riskTier || 'MEDIUM'),
        cleanStr(r.primaryAnalystName || r.actor || 'Analyst'),
        cleanStr(r.primaryAnalystId || r.actorId || 'ANL-001'),
        cleanStr(r.secondaryApproverName || 'N/A - Single Approval'),
        cleanStr(r.notes || r.reason || 'Regulatory compliance verification')
      ];

      rows.push(row.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export default auditService;
