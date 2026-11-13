# Weather feasibility — personal/internal trial, checked 2026-11-13

Primary-source research only: no accounts, keys, forecast endpoint calls or private
source/GPS uploads. **No verified free/no-billing Vietnam 30-minute nowcast source
has been selected.** Existing rules/types/retention remain accepted intent.

User follow-up Q-MOB-26: “Giữ yêu cầu 30 phút; chưa triển khai weather khi chưa có
nguồn phù hợp”. Therefore do not implement hourly advisories as a substitute or
claim that weather has been implemented. Traffic work depends on routing separately.

| Candidate | Verified limitation |
|---|---|
| Open-Meteo | Free public API is non-commercial; high-frequency values outside Central Europe/North America interpolate hourly forecasts, not verified Vietnam rain-onset nowcast |
| OpenWeather One Call | Free daily allowance still requires billing form/pay-per-call subscription |
| Tomorrow.io / WeatherAPI | Minute precipitation belongs to premium/paid tiers in current docs |
| MET Norway | Global location forecast exists, but nowcast is Nordic only |
| RainViewer | Dedicated transition notice discontinues future nowcast from 2026-01-01; generic API page conflicts |
| AccuWeather | Free MinuteCast overview vs FAQ/pricing describing 14-day trial; Vietnam coverage and sustained free access unverified |
| WeatherKit | Developer Program dependency; direct API availability/next-hour coverage for Vietnam unverified |

Sources: [Open-Meteo forecast](https://open-meteo.com/en/docs),
[terms](https://open-meteo.com/en/terms), [licence](https://open-meteo.com/en/licence),
[OpenWeather FAQ](https://openweathermap.org/faq),
[Tomorrow forecast](https://docs.tomorrow.io/reference/weather-forecast),
[WeatherAPI pricing](https://www.weatherapi.com/pricing),
[MET product coverage](https://api.met.no/),
[RainViewer transition](https://www.rainviewer.com/api/transition-faq.html),
[conflicting API page](https://www.rainviewer.com/api.html),
[AccuWeather FAQ](https://developer.accuweather.com/faq),
[overview](https://developer.accuweather.com/documentation/overview),
[WeatherKit](https://developer.apple.com/weatherkit/).

NCHMF publishes dangerous-weather bulletins, but a documented free machine-readable
geo/time/severity/cancellation contract and reuse rights were not verified. Google
lists NCHMF as Vietnam alert source, which does not remove Google's billing need.
CAP Alert Hub is a further lead, not an implemented feed: Vietnam current endpoint,
freshness and licence remain unverified.
[NCHMF](https://www.nchmf.gov.vn/kttv/),
[Google alert sources](https://developers.google.com/maps/documentation/weather/weather-alerts),
[CAP operator](https://www.alert-hub.org/).

For any future source, distinguish acquisition time/model issue time/forecast
validity and native resolution; generationtime_ms is not a timestamp. A weather
code alone does not authorize dangerous-warning bypass of quiet hours. Calling a
hot threshold 'unusual' needs an approved baseline or official severity. Provider
capability and danger/probability rules must be resolved before implementation.
