const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
const adminUser = { name: 'pizza diner', email: 'reg@test.com', password: 'toomanysecrets', roles: [{ role: Role.Admin }] };

beforeAll(async () => {
    await DB.resetDatabase();
    testUser.email = randomName() + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    expectValidJwt(testUserAuthToken);

    adminUser.name = randomName();
    adminUser.email = adminUser.name + '@admin.com';
    await DB.addUser(adminUser);

});

describe('auth tests', () => {
    test('login', async () => {
        const loginRes = await request(app).put('/api/auth').send(testUser);
        expect(loginRes.status).toBe(200);
        expectValidJwt(loginRes.body.token);

        const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
        delete expectedUser.password;
        expect(loginRes.body.user).toMatchObject(expectedUser);
    });

    test('logout', async () => {
        const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
        expect(logoutRes.status).toBe(200);
        expect(logoutRes.body.message).toMatch('logout successful');
    });

    test('register', async () => {
        const registerRes = await request(app).post('/api/auth').send(testUser);
        expect(registerRes.status).toBe(200);
        expectValidJwt(registerRes.body.token);

        const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
        delete expectedUser.password;
        expect(registerRes.body.user).toMatchObject(expectedUser);

    });
});

describe('order tests', () => {
    // test('login', async () => {
    //     const loginRes = await request(app).put('/api/auth').send(testUser);
    //     expect(loginRes.status).toBe(200);
    //     expectValidJwt(loginRes.body.token);

    //     const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
    //     delete expectedUser.password;
    //     expect(loginRes.body.user).toMatchObject(expectedUser);
    // });

    // test('logout', async () => {
    //     const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
    //     expect(logoutRes.status).toBe(200);
    //     expect(logoutRes.body.message).toMatch('logout successful');
    // });

    // test('register', async () => {
    //     const registerRes = await request(app).post('/api/auth').send(testUser);
    //     expect(registerRes.status).toBe(200);
    //     expectValidJwt(registerRes.body.token);

    //     const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
    //     delete expectedUser.password;
    //     expect(registerRes.body.user).toMatchObject(expectedUser);

    // });
});



function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}