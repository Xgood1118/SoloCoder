const axios = require('axios');
const storage = require('./storage');

const RETRY_DELAYS = [1000, 5000, 30000];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWebhookWithRetry(formId, submissionId, url, data) {
  let logId = null;
  let lastError = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await axios.post(url, data, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'X-Form-Submission': submissionId
        }
      });

      if (logId) {
        storage.updateWebhookLog(logId, 'success', null);
      } else {
        storage.createWebhookLog(formId, submissionId, url, 'success', null);
      }

      return { success: true, status: response.status };
    } catch (error) {
      lastError = error.message;
      
      if (logId) {
        storage.updateWebhookLog(logId, 'retrying', lastError);
      } else {
        const log = storage.createWebhookLog(formId, submissionId, url, 'retrying', lastError);
        logId = log.id;
      }

      if (attempt < RETRY_DELAYS.length) {
        await sleep(RETRY_DELAYS[attempt]);
      }
    }
  }

  if (logId) {
    storage.updateWebhookLog(logId, 'failed', lastError);
  }

  return { success: false, error: lastError };
}

async function triggerWebhook(formId, submission) {
  const form = storage.getForm(formId);
  if (!form || !form.webhookUrl) {
    return null;
  }

  return sendWebhookWithRetry(
    formId,
    submission.id,
    form.webhookUrl,
    {
      formId,
      formName: form.name,
      submissionId: submission.id,
      data: submission.data,
      submittedAt: submission.createdAt
    }
  );
}

async function replayWebhook(submissionId) {
  const submission = storage.getSubmission(submissionId);
  if (!submission) {
    return { success: false, error: 'Submission not found' };
  }

  const form = storage.getForm(submission.formId);
  if (!form || !form.webhookUrl) {
    return { success: false, error: 'Form or webhook URL not found' };
  }

  return sendWebhookWithRetry(
    submission.formId,
    submissionId,
    form.webhookUrl,
    {
      formId: submission.formId,
      formName: form.name,
      submissionId: submission.id,
      data: submission.data,
      submittedAt: submission.createdAt,
      isReplay: true
    }
  );
}

module.exports = {
  triggerWebhook,
  replayWebhook,
  sendWebhookWithRetry
};
