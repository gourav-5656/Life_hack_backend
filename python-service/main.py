from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class XPEvent(BaseModel):
    user_id: str
    xp_amount: int
    time_since_last_completion: float  # seconds

@app.post("/check-xp-event")
def check_xp_event(event: XPEvent):
    risk_score = 0.0
    valid = True
    if event.time_since_last_completion < 2 and event.xp_amount > 50:
        valid = False
        risk_score = 0.9
    return {"valid": valid, "risk_score": risk_score}