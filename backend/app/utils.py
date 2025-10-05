from datetime import datetime

def current_period():
    now = datetime.now()
    return now.month, now.year