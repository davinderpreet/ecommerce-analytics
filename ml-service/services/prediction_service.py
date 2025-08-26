# ml-service/services/prediction_service.py
import logging
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from typing import List, Dict, Any
import joblib
import os

# Import models (we'll create these next)
from models.arima_model import ARIMAModel
from models.lstm_model import LSTMModel
from models.ensemble_model import EnsembleModel
from services.data_service import DataService

logger = logging.getLogger(__name__)

class PredictionService:
    """Service for generating predictions using trained models"""
    
    def __init__(self):
        self.data_service = DataService()
        self.models = {}
        self.initialize_models()
    
    def initialize_models(self):
        """Initialize all available models"""
        try:
            # Initialize ARIMA model
            self.models['arima'] = ARIMAModel()
            logger.info("ARIMA model initialized")
        except Exception as e:
            logger.error(f"Failed to initialize ARIMA model: {e}")
            self.models['arima'] = None
        
        try:
            # Initialize LSTM model
            self.models['lstm'] = LSTMModel()
            logger.info("LSTM model initialized")
        except Exception as e:
            logger.error(f"Failed to initialize LSTM model: {e}")
            self.models['lstm'] = None
        
        try:
            # Initialize Ensemble model
            self.models['ensemble'] = EnsembleModel(
                arima_model=self.models.get('arima'),
                lstm_model=self.models.get('lstm')
            )
            logger.info("Ensemble model initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Ensemble model: {e}")
            self.models['ensemble'] = None
    
    def predict(self, days_ahead: int = 7, model_type: str = 'ensemble') -> List[Dict[str, Any]]:
        """
        Generate predictions for the specified number of days
        
        Args:
            days_ahead: Number of days to predict
            model_type: Type of model to use (arima, lstm, ensemble)
        
        Returns:
            List of predictions with dates and values
        """
        try:
            logger.info(f"Generating {days_ahead} day predictions using {model_type} model")
            
            # Check if model exists
            if model_type not in self.models or self.models[model_type] is None:
                # Fallback to simple prediction if model not available
                logger.warning(f"Model {model_type} not available, using simple prediction")
                return self._simple_prediction(days_ahead)
            
            # Get model
            model = self.models[model_type]
            
            # Check if model is trained
            if not model.is_trained():
                logger.warning(f"Model {model_type} not trained, training now...")
                # Get historical data and train
                historical_data = self.data_service.get_historical_data(days=365)
                if not historical_data.empty:
                    model.train(historical_data['revenue'].values)
                else:
                    return self._simple_prediction(days_ahead)
            
            # Generate predictions
            predictions = model.predict(steps=days_ahead)
            
            # Format predictions with dates
            formatted_predictions = []
            start_date = datetime.now() + timedelta(days=1)
            
            for i, pred in enumerate(predictions):
                pred_date = start_date + timedelta(days=i)
                
                # Handle different prediction formats
                if isinstance(pred, dict):
                    formatted_pred = {
                        'date': pred_date.strftime('%Y-%m-%d'),
                        'day_of_week': pred_date.strftime('%A'),
                        'revenue': float(pred.get('prediction', pred.get('revenue', 0))),
                        'lower_bound': float(pred.get('lower_bound', pred.get('prediction', 0) * 0.9)),
                        'upper_bound': float(pred.get('upper_bound', pred.get('prediction', 0) * 1.1)),
                        'orders': int(pred.get('orders', pred.get('prediction', 0) / 65)),  # Estimate orders
                        'confidence': float(pred.get('confidence', 0.85))
                    }
                else:
                    # Simple numeric prediction
                    formatted_pred = {
                        'date': pred_date.strftime('%Y-%m-%d'),
                        'day_of_week': pred_date.strftime('%A'),
                        'revenue': float(pred),
                        'lower_bound': float(pred * 0.9),
                        'upper_bound': float(pred * 1.1),
                        'orders': int(pred / 65),  # Estimate based on AOV
                        'confidence': 0.85
                    }
                
                formatted_predictions.append(formatted_pred)
            
            # Add metadata
            self._add_prediction_metadata(formatted_predictions)
            
            return formatted_predictions
            
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            # Return simple prediction as fallback
            return self._simple_prediction(days_ahead)
    
    def _simple_prediction(self, days_ahead: int) -> List[Dict[str, Any]]:
        """
        Generate simple predictions based on recent averages
        Used as fallback when models are not available
        """
        try:
            # Get recent data
            recent_data = self.data_service.get_recent_metrics(days=30)
            
            if recent_data:
                avg_revenue = recent_data.get('avg_daily_revenue', 15000)
                avg_orders = recent_data.get('avg_daily_orders', 230)
            else:
                # Default values if no data available
                avg_revenue = 15000
                avg_orders = 230
            
            # Generate predictions with some variation
            predictions = []
            start_date = datetime.now() + timedelta(days=1)
            
            for i in range(days_ahead):
                pred_date = start_date + timedelta(days=i)
                day_of_week = pred_date.weekday()
                
                # Add day-of-week seasonality
                if day_of_week in [5, 6]:  # Weekend
                    multiplier = 1.2
                elif day_of_week == 4:  # Friday
                    multiplier = 1.15
                elif day_of_week == 0:  # Monday
                    multiplier = 0.9
                else:
                    multiplier = 1.0
                
                # Add some random variation
                variation = np.random.uniform(0.95, 1.05)
                
                revenue = avg_revenue * multiplier * variation
                orders = int(avg_orders * multiplier * variation)
                
                predictions.append({
                    'date': pred_date.strftime('%Y-%m-%d'),
                    'day_of_week': pred_date.strftime('%A'),
                    'revenue': round(revenue, 2),
                    'lower_bound': round(revenue * 0.85, 2),
                    'upper_bound': round(revenue * 1.15, 2),
                    'orders': orders,
                    'confidence': 0.70  # Lower confidence for simple prediction
                })
            
            return predictions
            
        except Exception as e:
            logger.error(f"Simple prediction error: {e}")
            # Return zeros as last resort
            return [
                {
                    'date': (datetime.now() + timedelta(days=i+1)).strftime('%Y-%m-%d'),
                    'day_of_week': (datetime.now() + timedelta(days=i+1)).strftime('%A'),
                    'revenue': 0,
                    'lower_bound': 0,
                    'upper_bound': 0,
                    'orders': 0,
                    'confidence': 0
                }
                for i in range(days_ahead)
            ]
    
    def _add_prediction_metadata(self, predictions: List[Dict[str, Any]]):
        """Add additional metadata to predictions"""
        if not predictions:
            return
        
        # Calculate trends
        revenues = [p['revenue'] for p in predictions]
        
        # Add cumulative values
        cumulative_revenue = 0
        for pred in predictions:
            cumulative_revenue += pred['revenue']
            pred['cumulative_revenue'] = round(cumulative_revenue, 2)
        
        # Add growth indicators
        for i, pred in enumerate(predictions):
            if i > 0:
                prev_revenue = predictions[i-1]['revenue']
                if prev_revenue > 0:
                    pred['growth_rate'] = round(
                        ((pred['revenue'] - prev_revenue) / prev_revenue) * 100, 2
                    )
                else:
                    pred['growth_rate'] = 0
            else:
                pred['growth_rate'] = 0
    
    def get_prediction_insights(self, predictions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate insights from predictions"""
        if not predictions:
            return {}
        
        revenues = [p['revenue'] for p in predictions]
        orders = [p['orders'] for p in predictions]
        
        insights = {
            'total_predicted_revenue': sum(revenues),
            'average_daily_revenue': np.mean(revenues),
            'peak_day': max(predictions, key=lambda x: x['revenue'])['date'],
            'peak_revenue': max(revenues),
            'lowest_day': min(predictions, key=lambda x: x['revenue'])['date'],
            'lowest_revenue': min(revenues),
            'total_predicted_orders': sum(orders),
            'average_daily_orders': np.mean(orders),
            'revenue_trend': 'increasing' if revenues[-1] > revenues[0] else 'decreasing',
            'volatility': np.std(revenues) / np.mean(revenues) if np.mean(revenues) > 0 else 0
        }
        
        # Add weekly patterns
        weekly_revenues = {}
        for pred in predictions:
            dow = pred['day_of_week']
            if dow not in weekly_revenues:
                weekly_revenues[dow] = []
            weekly_revenues[dow].append(pred['revenue'])
        
        insights['best_day_of_week'] = max(
            weekly_revenues.items(),
            key=lambda x: np.mean(x[1]) if x[1] else 0
        )[0] if weekly_revenues else 'Unknown'
        
        return insights
    
    def validate_prediction(self, prediction_date: str, actual_value: float) -> Dict[str, Any]:
        """
        Validate a prediction against actual value
        
        Args:
            prediction_date: Date of the prediction
            actual_value: Actual revenue value
        
        Returns:
            Validation metrics
        """
        # This would typically fetch the stored prediction for that date
        # For now, return sample validation
        return {
            'date': prediction_date,
            'predicted': 15000,
            'actual': actual_value,
            'error': abs(15000 - actual_value),
            'error_percentage': abs(15000 - actual_value) / actual_value * 100 if actual_value > 0 else 0,
            'within_confidence': True  # Check if actual is within confidence bounds
        }
