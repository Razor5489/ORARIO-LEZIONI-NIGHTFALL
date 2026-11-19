<?php
/**
 * Plugin Name: Nightfall RP – Orari delle Lezioni
 * Description: Orari di Hogwarts per anni, settimane e Case, con gestione privata e consultazione pubblica.
 * Version: 1.1.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: Nightfall RP
 * Text Domain: nightfall-orari
 */

if (!defined('ABSPATH')) {
    exit;
}

final class Nightfall_Orari {
    private const OPTION = 'nightfall_orari_config_v1';
    private const HOUSES = array('grifondoro' => 'Grifondoro', 'tassorosso' => 'Tassorosso', 'corvonero' => 'Corvonero', 'serpeverde' => 'Serpeverde');
    private const DAYS = array('Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì');

    public static function init() {
        add_action('admin_menu', array(__CLASS__, 'admin_menu'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'admin_assets'));
        add_action('wp_enqueue_scripts', array(__CLASS__, 'public_assets'));
        add_shortcode('nightfall_orari', array(__CLASS__, 'shortcode'));
        add_action('admin_post_nf_save_schedule', array(__CLASS__, 'save_schedule'));
        add_action('admin_post_nf_save_teachers', array(__CLASS__, 'save_teachers'));
        add_action('admin_post_nf_save_settings', array(__CLASS__, 'save_settings'));
        add_action('admin_post_nf_clear_schedule', array(__CLASS__, 'clear_schedule'));
        add_action('admin_post_nf_restore_schedule', array(__CLASS__, 'restore_schedule'));
        add_action('admin_post_nf_copy_schedule', array(__CLASS__, 'copy_schedule'));
        add_action('admin_post_nf_import_csv', array(__CLASS__, 'import_csv'));
        add_action('admin_post_nf_export_csv', array(__CLASS__, 'export_csv'));
        add_action('admin_post_nf_create_page', array(__CLASS__, 'create_page'));
    }

    private static function seed() {
        $path = plugin_dir_path(__FILE__) . 'data/seed.json';
        $seed = json_decode((string) file_get_contents($path), true);
        return is_array($seed) ? $seed : array('schedules' => array(), 'teachers' => array(), 'settings' => array(), 'updated_at' => '');
    }

    public static function activate() {
        if (false === get_option(self::OPTION, false)) {
            add_option(self::OPTION, self::seed(), '', false);
        }
    }

    private static function data() {
        $data = get_option(self::OPTION, false);
        if (!is_array($data) || !isset($data['schedules'])) {
            $data = self::seed();
        }
        return $data;
    }

    private static function write($data) {
        $data['updated_at'] = current_time('mysql');
        update_option(self::OPTION, $data, false);
    }

    private static function key($year, $week) {
        $year = (int) $year;
        $week = (int) $week;
        return in_array($year, array(1, 2), true) && in_array($week, array(1, 2), true) ? "$year-$week" : '1-1';
    }

    private static function selection() {
        $year = isset($_GET['anno']) ? absint($_GET['anno']) : 1;
        $week = isset($_GET['settimana']) ? absint($_GET['settimana']) : 1;
        return array(in_array($year, array(1, 2), true) ? $year : 1, in_array($week, array(1, 2), true) ? $week : 1);
    }

    private static function normalize_subject($value) {
        $value = sanitize_text_field((string) $value);
        return $value === '' || strtolower($value) === 'da programmare' || strtolower($value) === 'tempo libero' ? 'Tempo libero' : $value;
    }

    private static function normalize_time($time, $fallback) {
        $time = sanitize_text_field((string) $time);
        return preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time) ? $time : $fallback;
    }

    private static function must_admin($nonce) {
        if (!current_user_can('manage_options')) {
            wp_die('Non hai i permessi per modificare gli orari.');
        }
        check_admin_referer($nonce);
    }

    private static function redirect($notice, $year = 1, $week = 1, $view = 'orari') {
        wp_safe_redirect(add_query_arg(array('page' => 'nightfall-orari', 'anno' => $year, 'settimana' => $week, 'view' => $view, 'nf_notice' => $notice), admin_url('admin.php')));
        exit;
    }

    private static function posted_selection() {
        $year = isset($_POST['anno']) ? absint($_POST['anno']) : 1;
        $week = isset($_POST['settimana']) ? absint($_POST['settimana']) : 1;
        if (!in_array($year, array(1, 2), true)) { $year = 1; }
        if (!in_array($week, array(1, 2), true)) { $week = 1; }
        return array($year, $week);
    }

    public static function save_schedule() {
        self::must_admin('nf_save_schedule');
        list($year, $week) = self::posted_selection();
        $data = self::data();
        $key = self::key($year, $week);
        $old = $data['schedules'][$key];
        $input = isset($_POST['slots']) && is_array($_POST['slots']) ? wp_unslash($_POST['slots']) : array();
        foreach ($old as $i => &$slot) {
            if (!isset($input[$i]) || !is_array($input[$i])) { continue; }
            $row = $input[$i];
            $slot['start'] = self::normalize_time($row['start'] ?? '', $slot['start']);
            $slot['end'] = self::normalize_time($row['end'] ?? '', $slot['end']);
            if (isset($row['subjects']) && is_array($row['subjects'])) {
                foreach (self::HOUSES as $house => $name) {
                    $slot['subjects'][$house] = self::normalize_subject($row['subjects'][$house] ?? '');
                }
            }
        }
        unset($slot);
        $data['schedules'][$key] = $old;
        self::write($data);
        self::redirect('salvato', $year, $week);
    }

    public static function clear_schedule() {
        self::must_admin('nf_clear_schedule');
        list($year, $week) = self::posted_selection();
        $data = self::data();
        $key = self::key($year, $week);
        foreach ($data['schedules'][$key] as &$slot) {
            foreach (self::HOUSES as $house => $label) { $slot['subjects'][$house] = 'Tempo libero'; }
        }
        unset($slot);
        self::write($data);
        self::redirect('svuotato', $year, $week);
    }

    public static function restore_schedule() {
        self::must_admin('nf_restore_schedule');
        list($year, $week) = self::posted_selection();
        $key = self::key($year, $week);
        $data = self::data();
        $seed = self::seed();
        $data['schedules'][$key] = $seed['schedules'][$key];
        self::write($data);
        self::redirect('ripristinato', $year, $week);
    }

    public static function copy_schedule() {
        self::must_admin('nf_copy_schedule');
        list($year, $week) = self::posted_selection();
        $target_week = isset($_POST['target_week']) && absint($_POST['target_week']) === 1 ? 1 : 2;
        if ($target_week === $week) { self::redirect('nessuna_copia', $year, $week); }
        $data = self::data();
        $data['schedules'][self::key($year, $target_week)] = $data['schedules'][self::key($year, $week)];
        self::write($data);
        self::redirect('copiato', $year, $target_week);
    }

    public static function save_teachers() {
        self::must_admin('nf_save_teachers');
        $data = self::data();
        $input = isset($_POST['teachers']) && is_array($_POST['teachers']) ? wp_unslash($_POST['teachers']) : array();
        foreach ($data['teachers'] as $subject => &$row) {
            $key = sanitize_key($subject);
            if (isset($input[$key]) && is_array($input[$key])) {
                foreach (array('primary', 'secondary', 'staff') as $role) {
                    $row[$role] = sanitize_text_field($input[$key][$role] ?? '');
                }
            }
        }
        unset($row);
        self::write($data);
        self::redirect('docenti_salvati', 1, 1, 'docenti');
    }

    public static function save_settings() {
        self::must_admin('nf_save_settings');
        $data = self::data();
        $data['settings']['show_teachers'] = !empty($_POST['show_teachers']);
        self::write($data);
        self::redirect('impostazioni_salvate', 1, 1, 'strumenti');
    }

    private static function clean_csv_row($row) {
        if (!is_array($row)) { return array(); }
        return array_map(function ($item) {
            return trim((string) $item);
        }, $row);
    }

    public static function import_csv() {
        self::must_admin('nf_import_csv');
        list($year, $week) = self::posted_selection();
        if (!isset($_FILES['csv']) || !is_array($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
            self::redirect('csv_errore', $year, $week, 'strumenti');
        }
        $file = $_FILES['csv'];
        if ((int) $file['size'] > 2 * 1024 * 1024 || strtolower(pathinfo(sanitize_file_name($file['name']), PATHINFO_EXTENSION)) !== 'csv') {
            self::redirect('csv_errore', $year, $week, 'strumenti');
        }
        $handle = fopen($file['tmp_name'], 'r');
        if (!$handle) { self::redirect('csv_errore', $year, $week, 'strumenti'); }
        // Le prime righe del foglio originale sono titoli senza separatori:
        // controlliamo più righe per riconoscere correttamente i CSV di Google.
        $scores = array(';' => 0, ',' => 0, "\t" => 0);
        for ($line_number = 0; $line_number < 16; $line_number++) {
            $sample = fgets($handle);
            if ($sample === false) { break; }
            foreach ($scores as $separator => $score) {
                $scores[$separator] += substr_count($sample, $separator);
            }
        }
        rewind($handle);
        arsort($scores);
        $delimiter = (string) array_key_first($scores);
        $rows = array();
        $header_found = false;
        $day = '';
        while (($raw = fgetcsv($handle, 8192, $delimiter, '"', '')) !== false) {
            $line = self::clean_csv_row($raw);
            if (isset($line[0])) { $line[0] = preg_replace('/^\xEF\xBB\xBF/', '', $line[0]); }
            if (!$header_found) {
                if (isset($line[0], $line[1], $line[2]) && strtoupper($line[0]) === 'GIORNO' && strtoupper($line[1]) === 'INIZIO' && strtoupper($line[2]) === 'FINE') {
                    $header_found = true;
                }
                continue;
            }
            if (count($line) < 7) { continue; }
            $day_key = strtr(strtolower($line[0]), array('Ì' => 'ì', 'À' => 'à', 'È' => 'è', 'É' => 'é', 'Ò' => 'ò', 'Ù' => 'ù'));
            $day_map = array('lunedì' => 'Lunedì', 'martedì' => 'Martedì', 'mercoledì' => 'Mercoledì', 'giovedì' => 'Giovedì', 'venerdì' => 'Venerdì');
            $candidate = isset($day_map[$day_key]) ? $day_map[$day_key] : '';
            if (in_array($candidate, self::DAYS, true)) { $day = $candidate; }
            if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $line[1]) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $line[2])) { continue; }
            if (!in_array($day, self::DAYS, true)) { continue; }
            $row = array('day' => $day, 'start' => $line[1], 'end' => $line[2], 'subjects' => array());
            $column = 3;
            foreach (self::HOUSES as $house => $label) { $row['subjects'][$house] = self::normalize_subject($line[$column++] ?? ''); }
            $rows[] = $row;
            if (count($rows) > 20) { break; }
        }
        fclose($handle);
        // Il formato di riferimento prevede esattamente 4 lezioni per ciascuno dei 5 giorni, in ordine.
        $valid = count($rows) === 20;
        if ($valid) {
            foreach ($rows as $i => $row) {
                if ($row['day'] !== self::DAYS[intdiv($i, 4)]) { $valid = false; break; }
            }
        }
        if (!$valid) { self::redirect('csv_formato', $year, $week, 'strumenti'); }
        $data = self::data();
        $data['schedules'][self::key($year, $week)] = $rows;
        self::write($data);
        self::redirect('importato', $year, $week);
    }

    public static function export_csv() {
        self::must_admin('nf_export_csv');
        list($year, $week) = self::posted_selection();
        $data = self::data();
        $filename = sprintf('nightfall-anno-%d-settimana-%d.csv', $year, $week);
        nocache_headers();
        header('Content-Type: text/csv; charset=UTF-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        $stream = fopen('php://output', 'w');
        fwrite($stream, "\xEF\xBB\xBF");
        fputcsv($stream, array('GIORNO', 'INIZIO', 'FINE', 'Grifondoro', 'Tassorosso', 'Corvonero', 'Serpeverde'), ';', '"', '');
        foreach ($data['schedules'][self::key($year, $week)] as $i => $row) {
            $line = array($i % 4 === 0 ? $row['day'] : '', $row['start'], $row['end']);
            foreach (self::HOUSES as $key => $name) { $line[] = $row['subjects'][$key] ?? 'Tempo libero'; }
            fputcsv($stream, $line, ';', '"', '');
        }
        fclose($stream);
        exit;
    }

    public static function create_page() {
        self::must_admin('nf_create_page');
        $pages = get_posts(array('post_type' => 'page', 'post_status' => 'any', 'posts_per_page' => -1, 's' => 'Orario delle lezioni'));
        foreach ($pages as $post) {
            if (has_shortcode($post->post_content, 'nightfall_orari')) { self::redirect('pagina_esistente', 1, 1, 'strumenti'); }
        }
        $id = wp_insert_post(array('post_title' => 'Orario delle lezioni', 'post_content' => '[nightfall_orari]', 'post_status' => 'publish', 'post_type' => 'page'), true);
        if (is_wp_error($id)) { self::redirect('pagina_errore', 1, 1, 'strumenti'); }
        self::redirect('pagina_creata', 1, 1, 'strumenti');
    }

    public static function admin_menu() {
        add_menu_page('Orari Nightfall', 'Orari Nightfall', 'manage_options', 'nightfall-orari', array(__CLASS__, 'admin_page'), 'dashicons-welcome-learn-more', 27);
    }

    public static function admin_assets($hook) {
        if ($hook !== 'toplevel_page_nightfall-orari') { return; }
        wp_enqueue_style('nf-admin', plugins_url('assets/admin.css', __FILE__), array(), '1.1.0');
        wp_enqueue_script('nf-admin', plugins_url('assets/admin.js', __FILE__), array(), '1.1.0', true);
    }

    public static function public_assets() {
        wp_register_style('nf-public', plugins_url('assets/public.css', __FILE__), array(), '1.1.0');
        wp_register_script('nf-public', plugins_url('assets/public.js', __FILE__), array(), '1.1.0', true);
        global $post;
        if ($post && has_shortcode((string) $post->post_content, 'nightfall_orari')) {
            wp_enqueue_style('nf-public');
            wp_enqueue_script('nf-public');
        }
    }

    public static function shortcode($atts = array()) {
        $atts = shortcode_atts(array('anno' => 1, 'settimana' => 1, 'casa' => 'tutte'), $atts, 'nightfall_orari');
        $year = in_array((int) $atts['anno'], array(1, 2), true) ? (int) $atts['anno'] : 1;
        $week = in_array((int) $atts['settimana'], array(1, 2), true) ? (int) $atts['settimana'] : 1;
        $house = array_key_exists($atts['casa'], self::HOUSES) ? $atts['casa'] : 'tutte';
        $data = self::data();
        wp_enqueue_style('nf-public');
        wp_enqueue_script('nf-public');
        $show_teachers = !empty($data['settings']['show_teachers']);
        $payload = array('schedules' => $data['schedules'], 'teachers' => $show_teachers ? $data['teachers'] : array(), 'updated_at' => $data['updated_at'], 'show_teachers' => $show_teachers);
        $json = wp_json_encode($payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
        $stamp = !empty($data['updated_at']) ? mysql2date('d/m/Y · H:i', $data['updated_at']) : 'Programma scolastico';
        ob_start();
        ?>
        <section class="nf-app" data-year="<?php echo esc_attr($year); ?>" data-week="<?php echo esc_attr($week); ?>" data-house="<?php echo esc_attr($house); ?>" aria-label="Orario scolastico Nightfall">
          <div class="nf-glow" aria-hidden="true"></div>
          <div class="nf-content">
            <div class="nf-eyebrow"><span class="nf-star">✦</span> NIGHTFALL ROLEPLAY <span class="nf-star">✦</span></div>
            <div class="nf-crest" aria-hidden="true"><span>N</span><span>✦</span></div>
            <h2>Orario delle <em>Lezioni</em></h2>
            <p class="nf-subtitle">Scuola di Magia e Stregoneria di Hogwarts</p>
            <div class="nf-ornament" aria-hidden="true"><span></span> ✧ <span></span></div>
            <div class="nf-controls">
              <div class="nf-control-block"><span class="nf-control-label">ANNO SCOLASTICO</span>
                <div class="nf-choice" data-filter="year" role="group" aria-label="Seleziona anno">
                   <button type="button" data-value="1" aria-pressed="<?php echo $year === 1 ? 'true' : 'false'; ?>">1° anno</button>
                   <button type="button" data-value="2" aria-pressed="<?php echo $year === 2 ? 'true' : 'false'; ?>">2° anno</button>
                </div>
              </div>
              <div class="nf-control-block"><span class="nf-control-label">SETTIMANA</span>
                <div class="nf-choice" data-filter="week" role="group" aria-label="Seleziona settimana">
                   <button type="button" data-value="1" aria-pressed="<?php echo $week === 1 ? 'true' : 'false'; ?>">Settimana 1</button>
                   <button type="button" data-value="2" aria-pressed="<?php echo $week === 2 ? 'true' : 'false'; ?>">Settimana 2</button>
                </div>
              </div>
            </div>
            <div class="nf-filter-heading"><span>CONSULTA PER CASA</span><span class="nf-filter-separator">✧</span></div>
            <div class="nf-house-filters" role="group" aria-label="Seleziona una casa">
              <button type="button" data-house="tutte" aria-pressed="<?php echo $house === 'tutte' ? 'true' : 'false'; ?>"><span class="nf-house-dot nf-dot-all">✦</span> Tutte le Case</button>
              <?php foreach (self::HOUSES as $id => $name) : ?>
                <button type="button" data-house="<?php echo esc_attr($id); ?>" aria-pressed="<?php echo $house === $id ? 'true' : 'false'; ?>"><span class="nf-house-dot nf-dot-<?php echo esc_attr($id); ?>">◆</span> <?php echo esc_html($name); ?></button>
              <?php endforeach; ?>
            </div>
            <div class="nf-display" aria-live="polite">
              <?php self::fallback_table($data['schedules'][self::key($year, $week)]); ?>
            </div>
            <?php if ($show_teachers) : ?><div class="nf-teachers"></div><?php endif; ?>
            <footer class="nf-footer"><span>✦ <span class="nf-update"><?php echo esc_html($stamp); ?></span></span><button type="button" class="nf-print">⎙&nbsp; Stampa orario</button></footer>
          </div>
          <script type="application/json" class="nf-data"><?php echo $json; // JSON_HEX_* escapes markup. ?></script>
        </section>
        <?php
        return ob_get_clean();
    }

    private static function fallback_table($rows) {
        echo '<div class="nf-section-title"><h3>Programma settimanale</h3><span>Dal lunedì al venerdì</span></div>';
        foreach (self::DAYS as $day) {
            echo '<div class="nf-day"><div class="nf-day-title"><span>✧</span><h4>' . esc_html($day) . '</h4></div><div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>FASCIA ORARIA</th>';
            foreach (self::HOUSES as $id => $label) { echo '<th class="nf-th-' . esc_attr($id) . '">' . esc_html($label) . '</th>'; }
            echo '</tr></thead><tbody>';
            foreach ($rows as $row) {
                if ($row['day'] !== $day) { continue; }
                echo '<tr><th>' . esc_html($row['start'] . ' – ' . $row['end']) . '</th>';
                foreach (self::HOUSES as $id => $label) {
                    $subject = $row['subjects'][$id] ?? 'Tempo libero';
                    $subject = strtolower(trim($subject)) === 'da programmare' ? 'Tempo libero' : $subject;
                    echo '<td class="nf-cell-' . esc_attr($id) . '"><span class="nf-lesson' . ($subject === 'Tempo libero' ? ' nf-free' : '') . '">' . esc_html($subject) . '</span></td>';
                }
                echo '</tr>';
            }
            echo '</tbody></table></div></div>';
        }
    }

    private static function admin_url($year = 1, $week = 1, $view = 'orari') {
        return add_query_arg(array('page' => 'nightfall-orari', 'anno' => $year, 'settimana' => $week, 'view' => $view), admin_url('admin.php'));
    }

    private static function post_form_begin($action, $nonce, $year = 1, $week = 1, $extra = '') {
        echo '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '" ' . $extra . '>';
        echo '<input type="hidden" name="action" value="' . esc_attr($action) . '">';
        echo '<input type="hidden" name="anno" value="' . esc_attr($year) . '">';
        echo '<input type="hidden" name="settimana" value="' . esc_attr($week) . '">';
        wp_nonce_field($nonce);
    }

    public static function admin_page() {
        if (!current_user_can('manage_options')) { return; }
        list($year, $week) = self::selection();
        $view = isset($_GET['view']) && in_array($_GET['view'], array('orari', 'docenti', 'strumenti'), true) ? $_GET['view'] : 'orari';
        $data = self::data();
        $messages = array('salvato' => 'Orario salvato e aggiornato per gli studenti.', 'svuotato' => 'Materie svuotate. Tutti gli slot mostrano Tempo libero.', 'ripristinato' => 'Programma originale ripristinato.', 'copiato' => 'Programma copiato nella settimana selezionata.', 'nessuna_copia' => 'La settimana di destinazione coincide con quella di partenza.', 'docenti_salvati' => 'Elenco docenti salvato.', 'impostazioni_salvate' => 'Impostazioni aggiornate.', 'importato' => 'CSV importato correttamente.', 'csv_errore' => 'Carica un file CSV valido (massimo 2 MB).', 'csv_formato' => 'Formato CSV non valido: sono richieste 20 righe ordinate, quattro per ciascun giorno.', 'pagina_creata' => 'Pagina pubblica “Orario delle lezioni” creata.', 'pagina_esistente' => 'Esiste già una pagina che contiene lo shortcode.', 'pagina_errore' => 'Non è stato possibile creare la pagina.');
        ?>
        <div class="wrap nf-admin">
          <div class="nf-admin-head"><div><span class="nf-admin-kicker">NIGHTFALL ROLEPLAY · HOGWARTS</span><h1>Orari delle lezioni</h1><p>Gestisci gli orari pubblicati per gli studenti, separati per anno, settimana e Casa.</p></div><div class="nf-admin-mark">N<span>✦</span></div></div>
          <nav class="nf-admin-nav">
            <a class="<?php echo $view === 'orari' ? 'active' : ''; ?>" href="<?php echo esc_url(self::admin_url($year, $week)); ?>">✦ Programma lezioni</a>
            <a class="<?php echo $view === 'docenti' ? 'active' : ''; ?>" href="<?php echo esc_url(self::admin_url($year, $week, 'docenti')); ?>">♙ Corpo docenti</a>
            <a class="<?php echo $view === 'strumenti' ? 'active' : ''; ?>" href="<?php echo esc_url(self::admin_url($year, $week, 'strumenti')); ?>">⚙ Strumenti e pubblicazione</a>
          </nav>
          <?php if (isset($_GET['nf_notice']) && isset($messages[$_GET['nf_notice']])) : ?><div class="notice notice-info is-dismissible"><p><?php echo esc_html($messages[$_GET['nf_notice']]); ?></p></div><?php endif; ?>
          <?php if ($view === 'orari') : self::admin_schedule($data, $year, $week); elseif ($view === 'docenti') : self::admin_teachers($data); else : self::admin_tools($data, $year, $week); endif; ?>
        </div>
        <?php
    }

    private static function admin_schedule($data, $year, $week) {
        $key = self::key($year, $week);
        $rows = $data['schedules'][$key];
        ?>
        <div class="nf-admin-card">
          <div class="nf-admin-card-title"><div><h2>Programma delle quattro Case</h2><p>Seleziona anno e settimana. Inserisci le materie: puoi scrivere liberamente o scegliere un suggerimento.</p></div><span class="nf-admin-pill">20 fasce · 4 Case</span></div>
          <div class="nf-admin-selectors"><div><span>ANNO</span><div class="nf-admin-pills"><?php foreach (array(1, 2) as $y) : ?><a class="<?php echo $y === $year ? 'active' : ''; ?>" href="<?php echo esc_url(self::admin_url($y, $week)); ?>"><?php echo esc_html($y); ?>° anno</a><?php endforeach; ?></div></div><div><span>SETTIMANA</span><div class="nf-admin-pills"><?php foreach (array(1, 2) as $w) : ?><a class="<?php echo $w === $week ? 'active' : ''; ?>" href="<?php echo esc_url(self::admin_url($year, $w)); ?>">Settimana <?php echo esc_html($w); ?></a><?php endforeach; ?></div></div></div>
          <?php self::post_form_begin('nf_save_schedule', 'nf_save_schedule', $year, $week); ?>
          <div class="nf-admin-table-wrap"><table class="nf-edit-table"><thead><tr><th>GIORNO</th><th>INIZIO</th><th>FINE</th><?php foreach (self::HOUSES as $house => $label) : ?><th class="nf-admin-th-<?php echo esc_attr($house); ?>"><?php echo esc_html($label); ?></th><?php endforeach; ?></tr></thead><tbody>
            <?php foreach ($rows as $i => $slot) : ?><tr class="<?php echo $i % 4 === 0 ? 'nf-first-row' : ''; ?>"><th><?php echo $i % 4 === 0 ? esc_html($slot['day']) : '<span class="nf-muted-day">·</span>'; ?></th><td><input class="nf-time" aria-label="Inizio <?php echo esc_attr($slot['day'] . ' lezione ' . ($i % 4 + 1)); ?>" type="time" name="slots[<?php echo $i; ?>][start]" value="<?php echo esc_attr($slot['start']); ?>" required></td><td><input class="nf-time" aria-label="Fine <?php echo esc_attr($slot['day'] . ' lezione ' . ($i % 4 + 1)); ?>" type="time" name="slots[<?php echo $i; ?>][end]" value="<?php echo esc_attr($slot['end']); ?>" required></td><?php foreach (self::HOUSES as $house => $label) : ?><td><input type="text" list="nf-subjects" class="nf-subject" aria-label="<?php echo esc_attr($label . ' · ' . $slot['day'] . ' lezione ' . ($i % 4 + 1)); ?>" name="slots[<?php echo $i; ?>][subjects][<?php echo esc_attr($house); ?>]" value="<?php echo esc_attr($slot['subjects'][$house] ?? 'Tempo libero'); ?>"></td><?php endforeach; ?></tr><?php endforeach; ?>
          </tbody></table></div>
          <datalist id="nf-subjects"><option value="Tempo libero"><option value="DCAO"><option value="Pozioni"><option value="Incantesimi"><option value="Creature"><option value="Cura delle Creature Magiche"><option value="Erbologia"><option value="Divinazione"><option value="Trasfigurazione"><option value="Storia della Magia"><option value="Medimagia"></datalist>
          <div class="nf-admin-actions"><p>Le modifiche saranno visibili nella pagina pubblica appena salvi. I programmi degli altri anni/settimane rimangono invariati.</p><button type="submit" class="button button-primary button-hero">Salva programma</button></div>
          </form>
        </div>
        <?php
    }

    private static function admin_teachers($data) {
        ?>
        <div class="nf-admin-card"><div class="nf-admin-card-title"><div><h2>Elenco dei professori</h2><p>Archivio ricavato dal foglio iniziale. Aggiorna i nomi quando cambia il corpo docenti.</p></div></div>
        <?php self::post_form_begin('nf_save_teachers', 'nf_save_teachers'); ?>
          <div class="nf-admin-table-wrap"><table class="nf-edit-table nf-teacher-table"><thead><tr><th>MATERIA</th><th>PROFESSORE 1</th><th>PROFESSORE 2</th><th>PROFESSORE STAFF</th></tr></thead><tbody><?php foreach ($data['teachers'] as $subject => $row) : ?><tr><th><?php echo esc_html($subject); ?></th><?php foreach (array('primary', 'secondary', 'staff') as $role) : ?><td><input type="text" name="teachers[<?php echo esc_attr(sanitize_key($subject)); ?>][<?php echo esc_attr($role); ?>]" value="<?php echo esc_attr($row[$role] ?? ''); ?>" placeholder="Da assegnare"></td><?php endforeach; ?></tr><?php endforeach; ?></tbody></table></div><div class="nf-admin-actions"><p>Questi nominativi sono pubblici solo se attivi l'opzione “Mostra docenti”.</p><button type="submit" class="button button-primary">Salva docenti</button></div>
        </form></div>
        <?php
    }

    private static function admin_tools($data, $year, $week) {
        ?>
        <div class="nf-tool-grid">
          <div class="nf-admin-card"><h2>Pubblicazione WordPress</h2><p>Per mostrare gli orari agli studenti crea una pagina e inserisci lo shortcode:</p><div class="nf-code-row"><code>[nightfall_orari]</code><button type="button" class="button nf-copy-shortcode" data-copy="[nightfall_orari]">Copia</button></div><p>Il pannello di modifica è visibile solo agli amministratori WordPress.</p>
          <?php self::post_form_begin('nf_create_page', 'nf_create_page'); ?><button type="submit" class="button button-primary">Crea pagina pubblica automaticamente</button></form></div>
          <div class="nf-admin-card"><h2>Visibilità del corpo docenti</h2><p>Se attivata, la pagina pubblica mostra l'elenco dei professori e delle materie.</p>
          <?php self::post_form_begin('nf_save_settings', 'nf_save_settings'); ?><label class="nf-switch"><input type="checkbox" name="show_teachers" value="1" <?php checked(!empty($data['settings']['show_teachers'])); ?>><span>Mostra i professori agli studenti</span></label><div class="nf-tool-action"><button type="submit" class="button button-primary">Salva impostazione</button></div></form></div>
          <div class="nf-admin-card"><h2>Importa dal foglio Google (CSV)</h2><p>Dal foglio Google apri il tab dell'anno e settimana, poi <strong>File → Scarica → Valori separati da virgola (.csv)</strong>. Importalo qui: verranno aggiornate solo le 20 righe del programma selezionato.</p>
          <?php self::post_form_begin('nf_import_csv', 'nf_import_csv', $year, $week, 'enctype="multipart/form-data"'); ?><label for="nf-csv">Destinazione: <strong>Anno <?php echo esc_html($year); ?> · Settimana <?php echo esc_html($week); ?></strong></label><input id="nf-csv" type="file" name="csv" accept=".csv,text/csv" required><div class="nf-tool-action"><button type="submit" class="button button-primary">Importa CSV</button></div></form></div>
          <div class="nf-admin-card"><h2>Esporta e riutilizza</h2><p>Scarica le lezioni in CSV per archiviarle o modificarle in un foglio di calcolo.</p><?php self::post_form_begin('nf_export_csv', 'nf_export_csv', $year, $week); ?><button type="submit" class="button">Esporta Anno <?php echo esc_html($year); ?> · Settimana <?php echo esc_html($week); ?></button></form></div>
          <div class="nf-admin-card"><h2>Duplica una settimana</h2><p>Copia il programma di Anno <?php echo esc_html($year); ?>, Settimana <?php echo esc_html($week); ?> nell'altra settimana. Sostituisce le lezioni di destinazione.</p><?php self::post_form_begin('nf_copy_schedule', 'nf_copy_schedule', $year, $week); ?><input type="hidden" name="target_week" value="<?php echo $week === 1 ? '2' : '1'; ?>"><button type="submit" class="button nf-confirm" data-confirm="Vuoi sostituire tutte le lezioni della settimana di destinazione?">Copia nella settimana <?php echo $week === 1 ? '2' : '1'; ?></button></form></div>
          <div class="nf-admin-card"><h2>Azzera o ripristina</h2><p>Intervieni solo sul programma <strong>Anno <?php echo esc_html($year); ?> · Settimana <?php echo esc_html($week); ?></strong>.</p><div class="nf-danger-actions"><?php self::post_form_begin('nf_clear_schedule', 'nf_clear_schedule', $year, $week); ?><button type="submit" class="button nf-confirm" data-confirm="Vuoi sostituire tutte le lezioni della settimana con Tempo libero?">Svuota le materie</button></form><?php self::post_form_begin('nf_restore_schedule', 'nf_restore_schedule', $year, $week); ?><button type="submit" class="button nf-confirm" data-confirm="Vuoi ripristinare il programma iniziale, perdendo le modifiche di questa settimana?">Ripristina dati iniziali</button></form></div></div>
        </div>
        <p class="nf-admin-note">Il sito non sincronizza automaticamente le modifiche con Google Sheets: puoi gestire tutto da WordPress oppure importare un nuovo CSV quando necessario.</p>
        <?php
    }
}

register_activation_hook(__FILE__, array('Nightfall_Orari', 'activate'));
Nightfall_Orari::init();
