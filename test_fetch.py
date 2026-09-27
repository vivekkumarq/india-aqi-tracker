from fetch import sub_index, city_row

assert sub_index("pm25", 30) == 50
assert sub_index("pm25", 45) == 75
assert sub_index("pm10", 300) == 250
assert sub_index("co", 1.5) == 75
assert sub_index("pm25", 999) == 500

hourly = {v: [60.0] * 24 for v in ["pm2_5", "pm10", "nitrogen_dioxide", "sulphur_dioxide", "ozone"]}
hourly["carbon_monoxide"] = [500.0] * 24  # 0.5 mg/m3
row = city_row(hourly)
assert row[:2] == [100, "pm25"], row
print("ok")
