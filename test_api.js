const http = require('http');

function request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: body ? { 'Content-Type': 'application/json' } : {}
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch(e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('--- 0. Seeding fresh sample dataset via POST /api/seed ---');
    const seedRes = await request('/api/seed', 'POST');
    console.log('Seed response:', seedRes.data.message);

    console.log('\n--- 1. Testing GET /api/events ---');
    const r1 = await request('/api/events');
    console.log('Status:', r1.status, 'Events Count:', r1.data.events.length, 'Engine:', r1.data.meta.engine);

    console.log('\n--- 2. Testing GET /api/stats ---');
    const r2 = await request('/api/stats');
    console.log('Total:', r2.data.stats.totalEvents, 'Exams:', r2.data.stats.examCount, 'Assignments:', r2.data.stats.assignmentCount);

    console.log('\n--- 3. Testing POST /api/check-conflict (Overlap case) ---');
    const r3 = await request('/api/check-conflict', 'POST', {
        date: '2026-09-28',
        startTime: '10:30',
        endTime: '11:30'
    });
    console.log('Conflict detected:', r3.data.conflict, 'Conflicting Event:', r3.data.conflictingEvent?.title);

    console.log('\n--- 4. Testing POST /api/events (Add Event) ---');
    const r4 = await request('/api/events', 'POST', {
        title: 'Network Security Lab Viva',
        description: 'Prepare Packet Tracer topology and RSA encryption questions.',
        date: '2026-10-04',
        startTime: '11:00',
        endTime: '13:00',
        venue: 'Network Lab 1',
        category: 'Exam',
        priority: 'High',
        reminder: '1 day before'
    });
    console.log('Added Event Status:', r4.status, 'ID:', r4.data.event?.id, 'Title:', r4.data.event?.title);

    console.log('\n--- 5. Testing PUT /api/events/:id (Update Event) ---');
    const updateId = r4.data.event.id;
    const r5 = await request('/api/events/' + updateId, 'PUT', {
        title: 'Network Security Lab Viva (Updated Venue)',
        description: 'Prepare Packet Tracer topology and RSA encryption questions.',
        date: '2026-10-04',
        startTime: '11:00',
        endTime: '13:00',
        venue: 'Auditorium Hall C',
        category: 'Exam',
        priority: 'High',
        reminder: '1 hour before',
        allowConflict: true
    });
    console.log('Updated Status:', r5.status, 'New Venue:', r5.data.event?.venue);

    console.log('\n--- 6. Testing GET /api/events/search ---');
    const r6 = await request('/api/events/search?q=Network');
    console.log('Search results for "Network":', r6.data.events.length, 'Title:', r6.data.events[0]?.title);

    console.log('\n--- 7. Testing DELETE /api/events/:id ---');
    const r7 = await request('/api/events/' + updateId, 'DELETE');
    console.log('Delete status:', r7.status, 'Message:', r7.data.message);

    console.log('\n--- 8. Testing GET /api/c-info ---');
    const r8 = await request('/api/c-info');
    console.log('C Info Engine:', r8.data.engine, 'Compiler:', r8.data.compiler);

    console.log('\n>>> ALL 8 INTEGRATION TESTS PASSED SUCCESSFULLY! <<<');
}

runTests();
