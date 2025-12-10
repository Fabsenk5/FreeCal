import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
// import eventRoutes from './routes/eventRoutes'; // TODO

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
        // Don't log passwords
        const body = { ...req.body };
        if (body.password) body.password = '***';
        console.log('Body:', JSON.stringify(body));
    }
    next();
});

// Routes
app.use('/api/auth', authRoutes);
import apiRoutes from './routes/apiRoutes';
app.use('/api', apiRoutes);
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
