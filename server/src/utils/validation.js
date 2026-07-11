// Small validation helpers shared across controllers. Limits match the
// VARCHAR lengths in schema.sql - keeping them in sync avoids a confusing
// "value too long for type character varying" Postgres error reaching the
// user instead of a clear 400 response.

const LIMITS = {
  BOARD_NAME: 200,
  COLUMN_NAME: 100,
  CARD_TITLE: 255,
  USER_NAME: 100,
};

// Returns an error string if invalid, or null if the value is fine.
function validateRequiredText(value, fieldLabel, maxLength) {
  if (!value || !value.trim()) {
    return `${fieldLabel} is required`;
  }
  if (value.trim().length > maxLength) {
    return `${fieldLabel} must be ${maxLength} characters or fewer`;
  }
  return null;
}

module.exports = { LIMITS, validateRequiredText };
