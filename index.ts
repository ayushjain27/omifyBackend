import express from 'express';
import cors from 'cors';
import connectToMongo from './config/database';
import auth from './routes/auth';
import paymentPage from './routes/paymentPage';
import userPaymentDetailsPage from './routes/userDetail';

const app = express();
const port = 12000;

connectToMongo();

app.get('/', (req, res) => {
    res.status(200).json({ 
      status: 'OK',
      message: 'Server is running',
      timestamp: new Date().toISOString()
    });
  });
  

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth', auth);
app.use('/paymentPage', paymentPage);
app.use('/userPaymentDetails', userPaymentDetailsPage);

app.listen(port, ()=>{
    console.log(`Example app listening at http://localhost:${port}`);
})