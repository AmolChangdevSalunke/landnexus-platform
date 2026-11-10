package com.landnexus.reporting.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.landnexus.reporting.application.TimelineForecaster.Result;
import org.junit.jupiter.api.Test;

class TimelineForecasterTest {

    private static final double[] TEN = {10, 20, 30, 40, 50, 60, 70, 80, 90, 100};

    @Test
    void conditionalShare_decidesTheLevel_andTheExplanationShowsTheCounts() {
        Result medium = TimelineForecaster.forecast(35, 75, TEN);   // 7 took longer than 35 h; 3 of them longer than 75 h
        assertThat(medium.level()).isEqualTo("MEDIUM");
        assertThat(medium.breachProbability()).isEqualTo(0.43);
        assertThat(medium.expectedRemainingHours()).isEqualTo(35.0);
        assertThat(medium.comparable()).isEqualTo(7);
        assertThat(medium.explanation()).contains("Of 7 similar completed items").contains("3 took longer than the 75 h");

        assertThat(TimelineForecaster.forecast(5, 55, TEN).level()).isEqualTo("HIGH");     // 5 of 10
        assertThat(TimelineForecaster.forecast(5, 200, TEN).level()).isEqualTo("LOW");      // none beyond the limit
        assertThat(TimelineForecaster.forecast(65, 60, TEN).breachProbability()).isEqualTo(1.0);   // already past the limit
    }

    @Test
    void waitingLongerThanEverBefore_isHigh_withoutAProbability() {
        Result r = TimelineForecaster.forecast(150, 75, TEN);

        assertThat(r.level()).isEqualTo("HIGH");
        assertThat(r.breachProbability()).isNull();
        assertThat(r.explanation()).contains("longer than all 10");
    }

    @Test
    void tooLittleHistory_isSaidPlainly_insteadOfGuessing() {
        assertThat(TimelineForecaster.forecast(10, 75, new double[] {1, 2, 3}).level()).isEqualTo("INSUFFICIENT_DATA");
        assertThat(TimelineForecaster.forecast(10, 75, new double[0]).explanation()).contains("Only 0");
        Result fewComparable = TimelineForecaster.forecast(85, 75, TEN);   // only 90 and 100 are longer
        assertThat(fewComparable.level()).isEqualTo("INSUFFICIENT_DATA");
        assertThat(fewComparable.comparable()).isEqualTo(2);
    }

    @Test
    void percentilesUseTheNearestRank() {
        assertThat(ForecastService.percentile(TEN, 0.5)).isEqualTo(50.0);
        assertThat(ForecastService.percentile(TEN, 0.9)).isEqualTo(90.0);
        assertThat(ForecastService.percentile(new double[0], 0.5)).isNull();
        assertThat(ForecastService.percentile(new double[] {7}, 0.9)).isEqualTo(7.0);
    }
}