const PRE_AUDITION_KEY_COUNT = 2;

function deriveApplicationStatus(application, documents) {
  const docs = Array.isArray(documents) ? documents : [];
  const appStatus = application ? application.status : 'PENDING';

  if (appStatus === 'REJECTED') {
    return {
      code: 'REJECTED',
      label: 'Rejected',
      tone: 'danger',
      message: application.feedback
        ? `Your application was rejected. Feedback: ${application.feedback}`
        : 'Your application was rejected. Please contact the OCA office for clarification.',
      canAccessPost: false
    };
  }

  if (appStatus === 'ACCEPTED') {
    return {
      code: 'ACCEPTED',
      label: 'Accepted',
      tone: 'success',
      message: 'Congratulations! You are accepted. You may now submit your post-audition requirement (Performer’s Profile).',
      canAccessPost: true
    };
  }

  if (appStatus === 'UNDER_REVIEW') {
    return {
      code: 'UNDER_REVIEW',
      label: 'Under Review',
      tone: 'warning',
      message: 'Your application and documents are currently under review by the Administrative Aide VI.',
      canAccessPost: false
    };
  }

  const preDocs = docs.filter((doc) => doc.requirement && doc.requirement.category === 'PRE_AUDITION');
  const revisionDoc = preDocs.find((doc) => doc.status === 'REVISION_REQUIRED' || doc.status === 'REJECTED');

  if (revisionDoc) {
    return {
      code: 'INCOMPLETE',
      label: 'Pre-Audition Requirements Incomplete',
      tone: 'danger',
      message: `Revision requested for “${revisionDoc.requirement.title}”. ${revisionDoc.feedback || 'Please replace the document.'}`,
      canAccessPost: false
    };
  }

  const acceptedPreDocs = preDocs.filter((doc) => doc.status === 'ACCEPTED');
  if (acceptedPreDocs.length >= PRE_AUDITION_KEY_COUNT) {
    return {
      code: 'READY',
      label: 'Ready for Audition',
      tone: 'info',
      message: 'All pre-audition requirements are accepted. You are ready for the audition.',
      canAccessPost: false
    };
  }

  if (preDocs.some((doc) => doc.status === 'SUBMITTED' || doc.status === 'UNDER_REVIEW')) {
    return {
      code: 'PENDING',
      label: 'Pending Application',
      tone: 'warning',
      message: 'Your documents have been submitted and are awaiting review.',
      canAccessPost: false
    };
  }

  return {
    code: 'INCOMPLETE',
    label: 'Pre-Audition Requirements Incomplete',
    tone: 'warning',
    message: 'Please upload the Waiver / Parent’s Consent Form and the Photocopy of Parent’s ID with three specimen signatures.',
    canAccessPost: false
  };
}

module.exports = { deriveApplicationStatus };
