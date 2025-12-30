const createResponse = (success, statusCode, message = '', data = null) => {
  return {
    success: success,
    statusCode: statusCode,
    message: message,
    data: data
  };
};

export const success = (message = '', data = null, statusCode = 200) => 
  createResponse(true, statusCode, message, data);

export const error = (message = '', statusCode = 400) => 
  createResponse(false, statusCode, message);