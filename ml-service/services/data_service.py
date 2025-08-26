import psycopg2
import pandas as pd
from datetime import datetime, timedelta
import os

class DataService:
    def __init__(self):
        self.db_url = os.getenv('DATABASE_URL')
    
    def get_connection(self):
        """Get database connection"""
        return psycopg2.connect(self.db_url)
    
    def get_historical_data(self, days=365):
        """Fetch historical sales data"""
        query = """
            SELECT 
                DATE(created_at) as date,
                SUM(total_cents) / 100.0 as revenue,
                COUNT(*) as orders
            FROM orders
            WHERE created_at >= NOW() - INTERVAL '%s days'
            GROUP BY DATE(created_at)
            ORDER BY date
        """
        
        with self.get_connection() as conn:
            df = pd.read_sql_query(query, conn, params=[days])
        
        # Fill missing dates with 0
        date_range = pd.date_range(
            start=df['date'].min(),
            end=df['date'].max(),
            freq='D'
        )
        df = df.set_index('date').reindex(date_range, fill_value=0)
        df.reset_index(inplace=True)
        df.columns = ['date', 'revenue', 'orders']
        
        return df
    
    def get_product_data(self):
        """Fetch product sales data"""
        query = """
            SELECT 
                p.sku,
                p.title,
                COUNT(oi.id) as sales_count,
                SUM(oi.total_cents) / 100.0 as total_revenue
            FROM products p
            JOIN order_items oi ON p.id = oi.product_id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.created_at >= NOW() - INTERVAL '90 days'
            GROUP BY p.sku, p.title
            ORDER BY sales_count DESC
            LIMIT 20
        """
        
        with self.get_connection() as conn:
            df = pd.read_sql_query(query, conn)
        
        return df
