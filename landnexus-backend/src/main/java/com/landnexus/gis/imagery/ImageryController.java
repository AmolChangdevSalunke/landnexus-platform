package com.landnexus.gis.imagery;

import com.landnexus.gis.imagery.ImageryService.Image;
import com.landnexus.gis.imagery.ImageryService.ImageryException;
import com.landnexus.gis.imagery.ImageryService.Layer;
import com.landnexus.gis.imagery.ImageryService.Status;
import com.landnexus.gis.imagery.ImageryService.TestResult;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.landnexus.gis.imagery.ImageryService.Capabilities;

/** Satellite imagery through the server. The picture request needs the Authorization header, so the browser fetches it as a blob. */
@RestController
@RequestMapping("/api/v1/gis/imagery")
public class ImageryController {

    private final ImageryService service;

    public ImageryController(ImageryService service) {
        this.service = service;
    }

    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/status")
    public Status status() {
        return service.status();
    }

    /** bbox = minLon,minLat,maxLon,maxLat (WGS84). layer = imagery (default) or overlay (a transparent layer such as cadastral lines). */
    @PreAuthorize("hasAuthority('GIS_READ')")
    @GetMapping("/map")
    public ResponseEntity<?> map(@RequestParam String bbox, @RequestParam(defaultValue = "768") int width,
                                 @RequestParam(defaultValue = "768") int height, @RequestParam(defaultValue = "imagery") String layer) {
        try {
            String[] parts = bbox.split(",");
            if (parts.length != 4) {
                throw new ImageryException(400, "bbox must be minLon,minLat,maxLon,maxLat");
            }
            double[] v = new double[4];
            for (int i = 0; i < 4; i++) {
                try {
                    v[i] = Double.parseDouble(parts[i].trim());
                } catch (NumberFormatException e) {
                    throw new ImageryException(400, "bbox must be four numbers");
                }
            }
            Layer which = "overlay".equalsIgnoreCase(layer) ? Layer.OVERLAY : Layer.IMAGERY;
            Image image = service.fetch(which, v[0], v[1], v[2], v[3], width, height);
            return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.contentType()))
                    .cacheControl(CacheControl.maxAge(java.time.Duration.ofMinutes(5)).cachePrivate())
                    .header("X-Content-Type-Options", "nosniff").body(image.bytes());
        } catch (ImageryException e) {
            return ResponseEntity.status(e.status()).contentType(MediaType.APPLICATION_JSON)
                    .body(errorBody(e));
        }
    }

    /** Asks the provider for a tiny picture and reports whether it worked. Never returns the URL or the secret. */
    @PreAuthorize("hasAuthority('SETTINGS_MANAGE')")
    @PostMapping("/test")
    public TestResult test() {
        return service.test();
    }

    /** Lists the layers the provider offers (for example to find the Bhuvan layer names). Administrators only. */
    @PreAuthorize("hasAuthority('SETTINGS_MANAGE')")
    @GetMapping("/capabilities")
    public ResponseEntity<?> capabilities(@RequestParam(required = false) String filter) {
        try {
            return ResponseEntity.ok(service.capabilities(filter));
        } catch (ImageryException e) {
            return ResponseEntity.status(e.status()).contentType(MediaType.APPLICATION_JSON)
                    .body(errorBody(e));
        }
    }

    private static Map<String, Object> errorBody(ImageryException exception) {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("status", exception.status());
        body.put("connectionState", exception.status() == 503 ? "NOT_CONFIGURED"
                : exception.providerStatus() != null
                        && (exception.providerStatus() == 401 || exception.providerStatus() == 403)
                        ? "AUTHENTICATION_FAILED" : "UNAVAILABLE");
        if (exception.providerStatus() != null) {
            body.put("providerStatus", exception.providerStatus());
        }
        body.put("message", exception.getMessage());
        return body;
    }
}