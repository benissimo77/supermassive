const createResponse = (success, statusCode) => {
    return {
      success: success,
      statusCode: statusCode
    };
  };
  
  module.exports = {
    success: (statusCode = 200) => createResponse(true, statusCode),
    error: (statusCode = 400) => createResponse(false, statusCode),
  };
  