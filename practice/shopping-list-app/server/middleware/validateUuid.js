const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUuid(paramName) {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!UUID_REGEX.test(value)) {
      return res.status(400).json({ error: `Invalid ${paramName} format` });
    }
    next();
  };
}

module.exports = { validateUuid };
