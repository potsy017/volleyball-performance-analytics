from pydantic import BaseModel
from typing import Optional
from datetime import date


class Athlete(BaseModel):
    athlete_id: int
    first_name: str
    last_name: str
    jersey: Optional[str] = None

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class DashboardSummaryRow(BaseModel):
    session_date: Optional[date] = None
    athlete_name: Optional[str] = None
    a_id: Optional[int] = None
    total_player_load: Optional[float] = None
    player_load_per_minute: Optional[float] = None
    high_jump_count: Optional[int] = None
    total_distance: Optional[float] = None
    field_time: Optional[float] = None
    recovery_score: Optional[float] = None
    hrv_rmssd_milli: Optional[float] = None
    resting_heart_rate: Optional[int] = None


class GymawareSession(BaseModel):
    id: Optional[int] = None
    a_id: Optional[int] = None
    athlete_name: Optional[str] = None
    session_date: Optional[date] = None
    gym_activity_name: Optional[str] = None
    exercise_name: Optional[str] = None
    bar_weight: Optional[float] = None
    rep_count: Optional[int] = None
    mean_velocity: Optional[float] = None
    peak_velocity: Optional[float] = None
    mean_power: Optional[float] = None
    peak_power: Optional[float] = None
    mean_watts_per_kg: Optional[float] = None
    peak_watts_per_kg: Optional[float] = None
    velocity_zone: Optional[str] = None
    movement_height: Optional[float] = None


class SessionVsPB(BaseModel):
    a_id: Optional[int] = None
    athlete_name: Optional[str] = None
    session_date: Optional[date] = None
    exercise_name: Optional[str] = None
    bar_weight: Optional[float] = None
    rep_count: Optional[int] = None
    todays_mean_velocity: Optional[float] = None
    todays_peak_velocity: Optional[float] = None
    pb_mean_velocity: Optional[float] = None
    pb_peak_velocity: Optional[float] = None
    pb_date: Optional[date] = None
    pct_of_pb_mean: Optional[float] = None
    pct_of_pb_peak: Optional[float] = None


class PersonalBest(BaseModel):
    a_id: Optional[int] = None
    athlete_name: Optional[str] = None
    exercise_name: Optional[str] = None
    bar_weight: Optional[float] = None
    pb_peak_velocity: Optional[float] = None
    pb_mean_velocity: Optional[float] = None
    pb_date: Optional[date] = None


class CatapultSession(BaseModel):
    id: Optional[int] = None
    a_id: Optional[int] = None
    athlete_name: Optional[str] = None
    session_date: Optional[date] = None
    cat_activity_name: Optional[str] = None
    total_distance: Optional[float] = None
    total_player_load: Optional[float] = None
    field_time: Optional[float] = None
    session_jump_count: Optional[int] = None
    load_index_local: Optional[float] = None
    player_load_per_minute: Optional[float] = None
    high_jump_count: Optional[int] = None


class ValdTest(BaseModel):
    id: Optional[int] = None
    a_id: Optional[int] = None
    athlete_name: Optional[str] = None
    session_date: Optional[date] = None
    vald_test_type: Optional[str] = None
    jump_height: Optional[float] = None
    peak_force: Optional[float] = None
    peak_power_vald: Optional[float] = None
    asymmetry_index: Optional[float] = None
    contraction_time: Optional[float] = None
    rfd: Optional[float] = None


class WhoopRecovery(BaseModel):
    id: Optional[int] = None
    a_id: Optional[int] = None
    athlete_name: Optional[str] = None
    session_date: Optional[date] = None
    recovery_score: Optional[float] = None
    hrv_rmssd_milli: Optional[float] = None
    resting_heart_rate: Optional[int] = None
    spo2_percentage: Optional[float] = None
    sleep_performance: Optional[float] = None
    sleep_efficiency: Optional[float] = None
    total_rem_milli: Optional[int] = None
    total_deep_milli: Optional[int] = None
    workout_strain: Optional[float] = None
