const createResponse = (success, statusCode) => {
  return {
    success: success,
    statusCode: statusCode,
  };
};

export const success = (statusCode = 200) => createResponse(true, statusCode);
export const error = (statusCode = 400) => createResponse(false, statusCode);