const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
const adminUser = { name: 'pizza diner', email: 'reg@test.com', password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
let adminUserAuthToken;
const franchiseeUser = { name: 'pizza diner', email: 'reg@test.com', password: 'franchise', roles: [{ role: Role.Diner }] };
let franchiseeAuthToken;

const veggie = { "title": "Veggie", "description": "A garden of delight", "image": "pizza1.png", "price": 0.0038 };
const margarita = { "title": "Margarita", "description": "Essential classic", "image": "pizza3.png", "price": 0.0042 };

beforeAll(async () => {
    await DB.resetDatabase();
    testUser.email = randomName() + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    expectValidJwt(testUserAuthToken);

    adminUser.name = randomName();
    adminUser.email = adminUser.name + '@admin.com';
    await DB.addUser(adminUser);
    const loginRes = await request(app).put('/api/auth').send(adminUser);
    adminUserAuthToken = loginRes.body.token;

    franchiseeUser.name = randomName();
    franchiseeUser.email = franchiseeUser.name + '@franchisee.com';
    await DB.addUser(franchiseeUser);
    const loginRes2 = await request(app).put('/api/auth').send(franchiseeUser);
    franchiseeAuthToken = loginRes2.body.token;
    franchiseeUser.id = loginRes2.body.user.id;
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

describe('franchise tests', () => {
    const franchise = randomName();
    let franchiseID;
    const store = randomName();
    test('create franchise', async () => {
        const franchiseCreateRes = await request(app).post('/api/franchise').send({
            "name": franchise,
            "admins": [{"email": franchiseeUser.email}]
        }).set('Authorization', `Bearer ${adminUserAuthToken}`);
        expect(franchiseCreateRes.status).toBe(200);
        expect(franchiseCreateRes.body.name).toMatch(franchise);
        expect(franchiseCreateRes.body.admins[0].email).toMatch(franchiseeUser.email);
        expect(franchiseCreateRes.body.admins.length).toBe(1);

        franchiseID = franchiseCreateRes.body.id;
    });

    test('create store', async () => {
        const storeCreateRes = await request(app).post(`/api/franchise/${franchiseID}/store`).send({ "name": store }).set('Authorization', `Bearer ${franchiseeAuthToken}`);
        expect(storeCreateRes.status).toBe(200);
        delete storeCreateRes.body.id;
        expect(storeCreateRes.body).toMatchObject({ name: store });
    });

    test('delete store', async () => {
        const storeCreateRes = await request(app).post(`/api/franchise/${franchiseID}/store`).send({ "name": randomName() }).set('Authorization', `Bearer ${franchiseeAuthToken}`);
        expect(storeCreateRes.status).toBe(200);

        const storeDeleteRes = await request(app).delete(`/api/franchise/${franchiseID}/store/${storeCreateRes.body.id}`).set('Authorization', `Bearer ${franchiseeAuthToken}`);
        expect(storeDeleteRes.status).toBe(200);
        expect(storeDeleteRes.body.message).toMatch('store deleted');
    });

    test('delete franchise', async () => {
        const franchiseCreateRes = await request(app).post('/api/franchise').send({
            "name": randomName(),
            "admins": [{ "email": franchiseeUser.email }]
        }).set('Authorization', `Bearer ${adminUserAuthToken}`);
        expect(franchiseCreateRes.status).toBe(200);

        const franchiseDeleteRes = await request(app).delete(`/api/franchise/${franchiseCreateRes.body.id}`).set('Authorization', `Bearer ${adminUserAuthToken}`);
        expect(franchiseDeleteRes.status).toBe(200);
        expect(franchiseDeleteRes.body.message).toMatch('franchise deleted');
    });

    test('get franchises', async () => {
        const franchiseViewRes = await request(app).get('/api/franchise').set('Authorization', `Bearer ${testUserAuthToken}`);
        expect(franchiseViewRes.status).toBe(200);
        expect(franchiseViewRes.body.franchises.length).toBe(1);
        expect(franchiseViewRes.body.franchises[0].name).toMatch(franchise);
        expect(franchiseViewRes.body.franchises[0].stores.length).toBe(1);
        expect(franchiseViewRes.body.franchises[0].stores[0].name).toMatch(store);
    });

    test('get user franchises', async () => {
        const franchiseViewRes = await request(app).get(`/api/franchise/${franchiseeUser.id}`).set('Authorization', `Bearer ${franchiseeAuthToken}`);
        expect(franchiseViewRes.status).toBe(200);
        expect(franchiseViewRes.body.length).toBe(1);
        expect(franchiseViewRes.body[0].name).toMatch(franchise);
        expect(franchiseViewRes.body[0].stores.length).toBe(1);
        expect(franchiseViewRes.body[0].stores[0].name).toMatch(store);
    });
});

describe('order tests', () => {
    test('add menu options', async () => {
        const addMenuRes1 = await request(app).put(`/api/order/menu`).send(veggie).set('Authorization', `Bearer ${adminUserAuthToken}`);
        const addMenuRes2 = await request(app).put(`/api/order/menu`).send(margarita).set('Authorization', `Bearer ${adminUserAuthToken}`);
        expect(addMenuRes1.status).toBe(200);
        expect(addMenuRes2.status).toBe(200);

        const getMenuRes = await request(app).get(`/api/order/menu`).set('Authorization', `Bearer ${testUserAuthToken}`);
        expect(getMenuRes.status).toBe(200);
        expect(getMenuRes.body.length).toBe(2);
        expect(getMenuRes.body).toMatchObject([veggie, margarita]);
    });

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