jest.mock('dmdb', () => ({
    OUT_FORMAT_OBJECT: 'OUT_FORMAT_OBJECT',
    createPool: jest.fn(),
}));

const dmdb = require('dmdb');
const { DmAdapter, normalizeDmPoolConfig } = require('../db_dm');

describe('DmAdapter 配置归一化', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('旧格式 connectString 会自动补成 dm:// URL', () => {
        const config = normalizeDmPoolConfig({
            user: 'DBA',
            password: 'PWD',
            connectString: '10.99.1.35:5236',
            poolMin: 2,
        });

        expect(config.connectString).toBe('dm://DBA:PWD@10.99.1.35:5236');
        expect(config.poolMin).toBe(2);
    });

    test('已是 dm:// 的 connectString 保持不变', () => {
        const config = normalizeDmPoolConfig({
            user: 'DBA',
            password: 'PWD',
            connectString: 'dm://DBA:PWD@10.99.1.35:5236',
        });

        expect(config.connectString).toBe('dm://DBA:PWD@10.99.1.35:5236');
    });

    test('initialize 会使用归一化后的连接串创建连接池', async () => {
        const fakePool = { close: jest.fn() };
        dmdb.createPool.mockResolvedValue(fakePool);

        const adapter = new DmAdapter({
            user: 'DBA',
            password: 'PWD',
            connectString: '10.99.1.35:5236',
            poolMin: 1,
            poolMax: 5,
        }, 'dm_test');

        await adapter.initialize();

        expect(dmdb.createPool).toHaveBeenCalledWith(expect.objectContaining({
            connectString: 'dm://DBA:PWD@10.99.1.35:5236',
            poolMin: 1,
            poolMax: 5,
        }));
        expect(adapter.pool).toBe(fakePool);
    });
});
