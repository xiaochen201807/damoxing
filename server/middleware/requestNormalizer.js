const logger = require('../utils/logger');

const NUMERIC_KEY_PATTERN = /^\d+$/;

function reconstructMalformedBody(body, options = {}) {
    const {
        maxSegments = 10000,
        maxJsonLength = 1024 * 1024,
    } = options;

    if (!body || typeof body !== 'object' || Array.isArray(body) || body['0'] !== '{') {
        return { body, reconstructed: false };
    }

    try {
        const keys = Object.keys(body)
            .filter(key => NUMERIC_KEY_PATTERN.test(key))
            .map(Number)
            .sort((a, b) => a - b);

        if (keys.length === 0) {
            return { body, reconstructed: false };
        }

        if (keys.length > maxSegments) {
            throw new Error(`Malformed body segment count exceeds limit: ${keys.length}`);
        }

        const jsonStr = keys.map(key => body[String(key)]).join('');

        if (jsonStr.length > maxJsonLength) {
            throw new Error(`Malformed body JSON length exceeds limit: ${jsonStr.length}`);
        }

        const parsedBody = JSON.parse(jsonStr);

        if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
            throw new Error('Malformed body JSON must resolve to an object');
        }

        return {
            body: { ...body, ...parsedBody },
            reconstructed: true,
            segmentCount: keys.length,
            jsonLength: jsonStr.length,
        };
    } catch (error) {
        return {
            body,
            reconstructed: false,
            error,
        };
    }
}

function normalizeMalformedBody(options = {}) {
    return (req, res, next) => {
        const result = reconstructMalformedBody(req.body, options);

        req.body = result.body;

        if (result.reconstructed) {
            logger.info(
                `[RequestNormalizer] Reconstructed malformed body for ${req.method} ${req.originalUrl} (segments=${result.segmentCount}, length=${result.jsonLength})`
            );
        } else if (result.error) {
            logger.warn(
                `[RequestNormalizer] Failed to reconstruct malformed body for ${req.method} ${req.originalUrl}: ${result.error.message}`
            );
        }

        next();
    };
}

module.exports = {
    reconstructMalformedBody,
    normalizeMalformedBody,
};
