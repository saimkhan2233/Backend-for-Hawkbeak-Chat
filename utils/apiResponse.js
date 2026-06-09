/**
 * Send a successful JSON response.
 */
const sendSuccess = (res, data = {}, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...data,
  });
};

/**
 * Send an error JSON response.
 */
const sendError = (res, message = "Something went wrong", statusCode = 500, errors = null) => {
  const response = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

module.exports = { sendSuccess, sendError };
