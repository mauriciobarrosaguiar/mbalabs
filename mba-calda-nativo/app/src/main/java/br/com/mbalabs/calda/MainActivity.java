package br.com.mbalabs.calda;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.Locale;

/** A calculator built with native Android widgets. No WebView, web assets or internet. */
public class MainActivity extends Activity {
    private static final int GREEN_DARK = Color.rgb(7, 71, 40);
    private static final int GREEN = Color.rgb(19, 138, 80);
    private static final int BG = Color.rgb(243, 248, 244);
    private static final int TEXT = Color.rgb(27, 47, 36);
    private static final int MUTED = Color.rgb(100, 121, 110);
    private static final int BORDER = Color.rgb(215, 230, 219);
    private static final String[] UNITS = {"mL/ha", "L/ha", "g/ha", "kg/ha"};
    private final ArrayList<Product> products = new ArrayList<>();
    private LinearLayout productList;
    private EditText capacityField, rateField;
    private TextView areaOutput, areaInfo, countOutput;
    private boolean restoring = false;
    private final DecimalFormat fmt = new DecimalFormat("#,##0.###", new DecimalFormatSymbols(new Locale("pt", "BR")));
    private SharedPreferences store;

    private static class Product {
        EditText name, dose;
        Spinner unit;
        TextView result;
        LinearLayout container;
    }

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setStatusBarColor(GREEN_DARK);
        getWindow().setNavigationBarColor(Color.WHITE);
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
        store = getSharedPreferences("mba_calda", MODE_PRIVATE);
        buildUi();
        loadState();
        calculate();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);
        LinearLayout page = vertical();
        page.setPadding(dp(18), dp(18), dp(18), dp(32));
        scroll.addView(page);

        LinearLayout header = vertical();
        header.setBackground(round(GREEN_DARK, 22, GREEN_DARK));
        header.setPadding(dp(22), dp(23), dp(22), dp(23));
        TextView brand = label("MBA  •  DRONES AGRÍCOLAS", 12, 0xFFBCE8C8, true);
        header.addView(brand);
        TextView title = label("CALCULADORA DE CALDA", 24, Color.WHITE, true);
        title.setPadding(0, dp(8), 0, dp(3));
        header.addView(title);
        TextView desc = label("Descubra quanto de cada produto vai em um tanque.", 14, 0xFFDCEFE2, false);
        header.addView(desc);
        page.addView(header, matchTop(0));

        TextView intro = label("1   DADOS DA APLICAÇÃO", 16, GREEN_DARK, true);
        intro.setPadding(dp(3), dp(25), 0, dp(10));
        page.addView(intro);
        LinearLayout inputs = card();
        inputs.addView(label("Capacidade do tanque", 14, TEXT, true));
        capacityField = numberField("Ex.: 40");
        inputs.addView(capacityField, matchTop(8));
        inputs.addView(helper("Litros (L) — volume final da calda"), matchTop(3));
        TextView rateLabel = label("Taxa de aplicação", 14, TEXT, true);
        rateLabel.setPadding(0, dp(16), 0, 0);
        inputs.addView(rateLabel);
        rateField = numberField("Ex.: 10");
        inputs.addView(rateField, matchTop(8));
        inputs.addView(helper("Litros por hectare (L/ha)"), matchTop(3));
        page.addView(inputs);

        LinearLayout resultCard = vertical();
        resultCard.setPadding(dp(18), dp(15), dp(18), dp(15));
        resultCard.setBackground(round(0xFFE1F3E8, 18, 0xFFB9E0C8));
        resultCard.addView(label("ÁREA COBERTA POR TANQUE", 12, GREEN_DARK, true));
        areaOutput = label("— ha", 37, GREEN_DARK, true);
        areaOutput.setPadding(0, dp(3), 0, 0);
        resultCard.addView(areaOutput);
        areaInfo = label("Preencha os dois campos acima.", 12, GREEN_DARK, false);
        resultCard.addView(areaInfo);
        page.addView(resultCard, matchTop(15));

        TextView prodTitle = label("2   PRODUTOS DA CALDA", 16, GREEN_DARK, true);
        prodTitle.setPadding(dp(3), dp(24), 0, dp(4));
        page.addView(prodTitle);
        TextView prodHint = helper("Informe a dose de cada produto por hectare.");
        page.addView(prodHint, matchTop(0));
        productList = vertical();
        page.addView(productList, matchTop(8));

        Button addBtn = button("+  Adicionar outro produto", GREEN_DARK, Color.WHITE);
        addBtn.setOnClickListener(v -> { addProduct("", "", 0); calculate(); });
        page.addView(addBtn, matchTop(13));

        countOutput = label("", 12, MUTED, false);
        countOutput.setGravity(Gravity.CENTER);
        page.addView(countOutput, matchTop(12));

        Button copyBtn = button("COPIAR RESUMO DA CALDA", GREEN, Color.WHITE);
        copyBtn.setOnClickListener(v -> copySummary());
        page.addView(copyBtn, matchTop(16));

        Button clearBtn = button("Limpar todos os campos", 0xFFEBF0EC, GREEN_DARK);
        clearBtn.setOnClickListener(v -> reset());
        page.addView(clearBtn, matchTop(9));

        TextView note = helper("Importante: o tanque contém o volume FINAL da calda. Confira bula, compatibilidade, sequência de mistura, EPI e orientação técnica antes de preparar ou aplicar.");
        note.setPadding(dp(6), dp(24), dp(6), dp(8));
        note.setLineSpacing(dp(2), 1f);
        page.addView(note);
        setContentView(scroll);
        watch(capacityField);
        watch(rateField);
    }

    private void addProduct(String name, String dose, int unitIndex) {
        Product p = new Product();
        LinearLayout card = card();
        p.container = card;
        LinearLayout top = horizontal();
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView productName = label("PRODUTO " + (products.size() + 1), 12, GREEN, true);
        top.addView(productName, new LinearLayout.LayoutParams(0, dp(40), 1));
        Button remove = button("Remover", 0xFFF7E8E8, 0xFF9F3838);
        LinearLayout.LayoutParams removeParams = new LinearLayout.LayoutParams(dp(100), dp(39));
        top.addView(remove, removeParams);
        remove.setOnClickListener(v -> {
            products.remove(p);
            productList.removeView(card);
            if (products.isEmpty()) addProduct("", "", 0);
            reindex();
            calculate();
        });
        card.addView(top);
        p.name = textField("Nome do produto (ex.: Produto A)");
        p.name.setText(name);
        card.addView(p.name, matchTop(8));
        card.addView(label("Dose por hectare", 13, TEXT, true), matchTop(13));
        LinearLayout doseRow = horizontal();
        doseRow.setGravity(Gravity.CENTER_VERTICAL);
        p.dose = numberField("Ex.: 250");
        p.dose.setText(dose);
        doseRow.addView(p.dose, new LinearLayout.LayoutParams(0, dp(50), 1));
        p.unit = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, UNITS);
        p.unit.setAdapter(adapter);
        p.unit.setSelection(Math.max(0, Math.min(UNITS.length - 1, unitIndex)));
        LinearLayout.LayoutParams spinnerP = new LinearLayout.LayoutParams(dp(107), dp(52));
        spinnerP.leftMargin = dp(5);
        doseRow.addView(p.unit, spinnerP);
        card.addView(doseRow, matchTop(5));
        p.result = label("Preencha a dose para calcular.", 15, GREEN_DARK, true);
        p.result.setPadding(dp(12), dp(11), dp(12), dp(11));
        p.result.setBackground(round(0xFFF0F8F2, 12, 0xFFD3EBD9));
        card.addView(p.result, matchTop(12));
        products.add(p);
        productList.addView(card, matchTop(12));
        watch(p.name);
        watch(p.dose);
        p.unit.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int pos, long id) { calculate(); }
            @Override public void onNothingSelected(AdapterView<?> parent) { }
        });
        calculate();
    }

    private void reindex() {
        for (int i = 0; i < products.size(); i++) {
            LinearLayout top = (LinearLayout) products.get(i).container.getChildAt(0);
            ((TextView)top.getChildAt(0)).setText("PRODUTO " + (i + 1));
        }
    }

    private void watch(EditText input) {
        input.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) { }
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) { calculate(); }
            @Override public void afterTextChanged(Editable s) { }
        });
    }

    private Double value(String s) {
        try {
            s = s.trim().replace(" ", "");
            if (s.contains(",")) s = s.replace(".", "").replace(',', '.');
            double x = Double.parseDouble(s);
            return Double.isFinite(x) && x >= 0 ? x : null;
        } catch (Exception e) { return null; }
    }

    private Double getHectares() {
        Double capacity = value(capacityField.getText().toString());
        Double rate = value(rateField.getText().toString());
        if (capacity == null || rate == null || capacity <= 0 || rate <= 0) return null;
        return capacity / rate;
    }

    private String amount(double quantity, int unit) {
        // Conversion only within the same kind: volume <-> volume, mass <-> mass.
        boolean volume = unit <= 1;
        double base = (unit == 0 || unit == 2) ? quantity : quantity * 1000;
        if (base >= 1000) return fmt.format(base / 1000.0) + (volume ? " L" : " kg");
        return fmt.format(base) + (volume ? " mL" : " g");
    }

    private void calculate() {
        if (areaOutput == null || products == null) return;
        Double hectares = getHectares();
        if (hectares == null) {
            areaOutput.setText("— ha");
            areaInfo.setText("Informe valores maiores que zero.");
        } else {
            areaOutput.setText(fmt.format(hectares) + " ha");
            areaInfo.setText(fmt.format(value(capacityField.getText().toString())) + " L ÷ " +
                fmt.format(value(rateField.getText().toString())) + " L/ha");
        }
        int completed = 0;
        for (Product p : products) {
            Double dose = value(p.dose.getText().toString());
            if (hectares == null || dose == null || dose <= 0) {
                p.result.setText("Preencha tanque, taxa e dose para calcular.");
            } else {
                p.result.setText("NO TANQUE:  " + amount(hectares * dose, p.unit.getSelectedItemPosition()));
                completed++;
            }
        }
        if (countOutput != null) countOutput.setText(completed + " de " + products.size() + " produtos calculados");
        if (!restoring) saveState();
    }

    private String buildSummary() {
        Double ha = getHectares();
        if (ha == null) return null;
        StringBuilder s = new StringBuilder("MBA CALDA — RESUMO\n");
        s.append("Tanque: ").append(capacityField.getText()).append(" L\n");
        s.append("Taxa: ").append(rateField.getText()).append(" L/ha\n");
        s.append("Área por tanque: ").append(fmt.format(ha)).append(" ha\n\n");
        int total = 0;
        for (Product p : products) {
            Double d = value(p.dose.getText().toString());
            if (d == null || d <= 0) continue;
            String name = p.name.getText().toString().trim();
            if (name.isEmpty()) name = "Produto " + (products.indexOf(p) + 1);
            s.append("• ").append(name).append(" (dose: ").append(fmt.format(d)).append(" ")
                .append(UNITS[p.unit.getSelectedItemPosition()]).append("): ")
                .append(amount(d * ha, p.unit.getSelectedItemPosition())).append(" por tanque\n");
            total++;
        }
        if (total == 0) return null;
        s.append("\nVerificar rótulo/bula, compatibilidade e sequência de mistura.");
        return s.toString();
    }

    private void copySummary() {
        String summary = buildSummary();
        if (summary == null) {
            Toast.makeText(this, "Informe tanque, taxa e pelo menos um produto.", Toast.LENGTH_LONG).show();
            return;
        }
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard != null) {
            clipboard.setPrimaryClip(ClipData.newPlainText("Resumo MBA Calda", summary));
            Toast.makeText(this, "Resumo copiado!", Toast.LENGTH_SHORT).show();
        }
    }

    private void reset() {
        restoring = true;
        capacityField.setText("");
        rateField.setText("");
        products.clear();
        productList.removeAllViews();
        addProduct("", "", 0);
        restoring = false;
        calculate();
        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null) imm.hideSoftInputFromWindow(capacityField.getWindowToken(), 0);
    }

    private void saveState() {
        if (capacityField == null) return;
        try {
            JSONObject saved = new JSONObject();
            saved.put("capacity", capacityField.getText().toString());
            saved.put("rate", rateField.getText().toString());
            JSONArray list = new JSONArray();
            for (Product p : products) {
                JSONObject item = new JSONObject();
                item.put("name", p.name.getText().toString());
                item.put("dose", p.dose.getText().toString());
                item.put("unit", p.unit.getSelectedItemPosition());
                list.put(item);
            }
            saved.put("products", list);
            store.edit().putString("form", saved.toString()).apply();
        } catch (Exception ignored) { }
    }

    private void loadState() {
        restoring = true;
        try {
            JSONObject saved = new JSONObject(store.getString("form", "{}"));
            capacityField.setText(saved.optString("capacity", ""));
            rateField.setText(saved.optString("rate", ""));
            JSONArray list = saved.optJSONArray("products");
            if (list != null) {
                for (int i = 0; i < list.length(); i++) {
                    JSONObject item = list.optJSONObject(i);
                    if (item == null) continue;
                    addProduct(item.optString("name", ""), item.optString("dose", ""), item.optInt("unit", 0));
                }
            }
        } catch (Exception ignored) { }
        if (products.isEmpty()) addProduct("", "", 0);
        restoring = false;
    }

    private LinearLayout vertical() { LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.VERTICAL); return l; }
    private LinearLayout horizontal() { LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.HORIZONTAL); return l; }
    private LinearLayout card() {
        LinearLayout c = vertical();
        c.setPadding(dp(17), dp(16), dp(17), dp(18));
        c.setBackground(round(Color.WHITE, 18, BORDER));
        c.setElevation(dp(1));
        return c;
    }
    private GradientDrawable round(int color, int radius, int border) {
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(color);
        bg.setCornerRadius(dp(radius));
        bg.setStroke(dp(1), border);
        return bg;
    }
    private TextView label(String text, int size, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(text); t.setTextSize(size); t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return t;
    }
    private TextView helper(String text) { return label(text, 12, MUTED, false); }
    private EditText textField(String hint) {
        EditText e = new EditText(this);
        e.setSingleLine(true); e.setTextSize(15); e.setTextColor(TEXT);
        e.setHint(hint); e.setHintTextColor(0xFF93A69A);
        e.setPadding(dp(13), 0, dp(12), 0);
        e.setBackground(round(0xFFF9FCF9, 11, BORDER));
        return e;
    }
    private EditText numberField(String hint) {
        EditText e = textField(hint);
        e.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        return e;
    }
    private Button button(String text, int bgColor, int fgColor) {
        Button b = new Button(this);
        b.setText(text); b.setTextColor(fgColor); b.setTextSize(13);
        b.setAllCaps(false);
        b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        b.setBackground(round(bgColor, 13, bgColor));
        b.setMinHeight(dp(48));
        return b;
    }
    private LinearLayout.LayoutParams matchTop(int margin) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = dp(margin);
        return p;
    }
    private int dp(float n) { return (int) (n * getResources().getDisplayMetrics().density + 0.5f); }
}
