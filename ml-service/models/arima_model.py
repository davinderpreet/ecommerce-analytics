import pandas as pd
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from pmdarima import auto_arima
import joblib
import os

class ARIMAModel:
    def __init__(self):
        self.model = None
        self.model_path = 'storage/models/arima_model.pkl'
        self.load_model()
    
    def train(self, data):
        """Train ARIMA model with automatic parameter selection"""
        # Convert to pandas Series if needed
        if isinstance(data, list):
            data = pd.Series(data)
        
        # Auto ARIMA to find best parameters
        auto_model = auto_arima(
            data,
            start_p=1, start_q=1,
            max_p=5, max_q=5,
            seasonal=True,
            m=7,  # Weekly seasonality
            stepwise=True,
            suppress_warnings=True
        )
        
        # Train final model with best parameters
        self.model = ARIMA(
            data,
            order=auto_model.order,
            seasonal_order=auto_model.seasonal_order
        ).fit()
        
        # Save model
        self.save_model()
        return self
    
    def predict(self, steps=7):
        """Generate predictions for next n steps"""
        if self.model is None:
            raise ValueError("Model not trained yet")
        
        predictions = self.model.forecast(steps=steps)
        
        # Add confidence intervals
        forecast_df = pd.DataFrame({
            'prediction': predictions,
            'lower_bound': predictions * 0.9,  # 10% margin
            'upper_bound': predictions * 1.1
        })
        
        return forecast_df.to_dict('records')
    
    def save_model(self):
        """Save trained model to disk"""
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump(self.model, self.model_path)
    
    def load_model(self):
        """Load model from disk if exists"""
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
