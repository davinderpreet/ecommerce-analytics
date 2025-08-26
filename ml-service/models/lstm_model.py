import numpy as np
import pandas as pd
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.preprocessing import MinMaxScaler
import os

class LSTMModel:
    def __init__(self):
        self.model = None
        self.scaler = MinMaxScaler()
        self.model_path = 'storage/models/lstm_model.h5'
        self.sequence_length = 30  # Use 30 days of history
        self.load_model()
    
    def prepare_sequences(self, data, n_steps):
        """Prepare sequences for LSTM"""
        X, y = [], []
        for i in range(len(data) - n_steps):
            X.append(data[i:i + n_steps])
            y.append(data[i + n_steps])
        return np.array(X), np.array(y)
    
    def build_model(self, input_shape):
        """Build LSTM architecture"""
        model = Sequential([
            LSTM(100, activation='relu', return_sequences=True, 
                 input_shape=input_shape),
            Dropout(0.2),
            LSTM(50, activation='relu', return_sequences=True),
            Dropout(0.2),
            LSTM(50, activation='relu'),
            Dropout(0.2),
            Dense(1)
        ])
        
        model.compile(optimizer='adam', loss='mse', metrics=['mae'])
        return model
    
    def train(self, data):
        """Train LSTM model"""
        # Normalize data
        data_normalized = self.scaler.fit_transform(
            np.array(data).reshape(-1, 1)
        )
        
        # Prepare sequences
        X, y = self.prepare_sequences(data_normalized, self.sequence_length)
        
        # Reshape for LSTM [samples, time steps, features]
        X = X.reshape((X.shape[0], X.shape[1], 1))
        
        # Build and train model
        self.model = self.build_model((X.shape[1], 1))
        
        early_stop = EarlyStopping(
            monitor='loss', 
            patience=10, 
            restore_best_weights=True
        )
        
        self.model.fit(
            X, y,
            epochs=100,
            batch_size=32,
            verbose=0,
            callbacks=[early_stop],
            validation_split=0.2
        )
        
        # Save model
        self.save_model()
        return self
    
    def predict(self, steps=7):
        """Generate predictions for next n steps"""
        if self.model is None:
            raise ValueError("Model not trained yet")
        
        predictions = []
        # Get last sequence from training data
        last_sequence = self.last_sequence.copy()
        
        for _ in range(steps):
            # Predict next value
            next_pred = self.model.predict(
                last_sequence.reshape(1, self.sequence_length, 1),
                verbose=0
            )[0, 0]
            
            # Inverse transform to get actual value
            actual_value = self.scaler.inverse_transform([[next_pred]])[0, 0]
            predictions.append(actual_value)
            
            # Update sequence for next prediction
            last_sequence = np.append(last_sequence[1:], next_pred)
        
        # Format predictions
        forecast_df = pd.DataFrame({
            'prediction': predictions,
            'lower_bound': np.array(predictions) * 0.95,
            'upper_bound': np.array(predictions) * 1.05
        })
        
        return forecast_df.to_dict('records')
    
    def save_model(self):
        """Save trained model"""
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        self.model.save(self.model_path)
        joblib.dump(self.scaler, self.model_path.replace('.h5', '_scaler.pkl'))
    
    def load_model(self):
        """Load model if exists"""
        if os.path.exists(self.model_path):
            self.model = load_model(self.model_path)
            self.scaler = joblib.load(self.model_path.replace('.h5', '_scaler.pkl'))
