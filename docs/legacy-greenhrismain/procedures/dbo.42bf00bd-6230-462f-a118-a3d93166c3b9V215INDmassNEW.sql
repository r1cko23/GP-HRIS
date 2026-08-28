

create PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V215INDmassNEW]
(
    @idclient VARCHAR(20),
    @PayrollPeriodStart DATE
)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        /* =========================================
           STEP 1: AGGREGATION (CORE PERFORMANCE)
        ========================================= */
        IF OBJECT_ID('tempdb..#Agg') IS NOT NULL DROP TABLE #Agg;

        SELECT 
            employee_id,
            COUNT(*) AS trxcount,
            SUM(grossamttaxable) AS totalgross,
            SUM(basic) AS totalbasic,
            SUM(othermandatorybasis) AS totalother
        INTO #Agg
        FROM payroll_summary
        WHERE idclientp = @idclient
        AND Date_Start = @PayrollPeriodStart
        GROUP BY employee_id;


        /* =========================================
           STEP 2: MAX PAYROLL PER EMPLOYEE
        ========================================= */
        IF OBJECT_ID('tempdb..#MaxPayroll') IS NOT NULL DROP TABLE #MaxPayroll;

        SELECT *
        INTO #MaxPayroll
        FROM (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY grossalary DESC) rn
            FROM payroll_summary
            WHERE idclientp = @idclient
            AND Date_Start = @PayrollPeriodStart
        ) x
        WHERE rn = 1;


        /* =========================================
           STEP 3: SSS
        ========================================= */
        UPDATE ps
        SET 
            contributionSSSEE = 
                CASE WHEN ps.withsss = 'Y' AND a.totalgross > 1000 THEN s.EmployeeSSS ELSE 0 END,
            contributionSSSER = 
                CASE WHEN ps.withsss = 'Y' AND a.totalgross > 1000 THEN s.EmployerSSS ELSE 0 END,
            contributionSSSECC = 
                CASE WHEN ps.withsss = 'Y' AND a.totalgross > 1000 THEN s.EmployerECC ELSE 0 END
        FROM payroll_summary ps
        JOIN #Agg a ON ps.employee_id = a.employee_id
        OUTER APPLY (
            SELECT TOP 1 *
            FROM SSS s
            WHERE s.Range <= a.totalgross
            ORDER BY s.Range DESC
        ) s
        WHERE ps.idclientp = @idclient
        AND ps.Date_Start = @PayrollPeriodStart;


        /* =========================================
           STEP 4: SSS PRO
        ========================================= */
        UPDATE ps
        SET 
            contributionSSSEEpro = 
                CASE WHEN ps.withssspro = 'Y' AND a.totalgross > 1000 THEN s.eepro ELSE 0 END,
            contributionSSSERpro = 
                CASE WHEN ps.withssspro = 'Y' AND a.totalgross > 1000 THEN s.erpro ELSE 0 END
        FROM payroll_summary ps
        JOIN #Agg a ON ps.employee_id = a.employee_id
        OUTER APPLY (
            SELECT TOP 1 *
            FROM SSS s
            WHERE s.Range <= a.totalgross
            ORDER BY s.Range DESC
        ) s
        WHERE ps.idclientp = @idclient
        AND ps.Date_Start = @PayrollPeriodStart;


        /* =========================================
           STEP 5: PHILHEALTH
        ========================================= */
        UPDATE ps
        SET 
            contributionphilhealthEE = 
                CASE WHEN ps.withphi = 'Y' AND a.totalgross >= 1000 
                     THEN (a.totalgross * ph.valPercentage)/2 ELSE 0 END,
            contributionphilhealthER = 
                CASE WHEN ps.withphi = 'Y' AND a.totalgross >= 1000 
                     THEN (a.totalgross * ph.valPercentage)/2 ELSE 0 END
        FROM payroll_summary ps
        JOIN #Agg a ON ps.employee_id = a.employee_id
        OUTER APPLY (
            SELECT TOP 1 *
            FROM Philhealth_2018 ph
            WHERE ph.Range <= a.totalgross
            ORDER BY ph.Range DESC
        ) ph
        WHERE ps.idclientp = @idclient
        AND ps.Date_Start = @PayrollPeriodStart;


        /* =========================================
           STEP 6: PAGIBIG
        ========================================= */
        UPDATE ps
        SET 
            contributionPagibigEE = 
                CASE WHEN ps.withpag = 'Y' AND a.totalgross > 1000 THEN 200 ELSE 0 END,
            contributionPagibigER = 
                CASE WHEN ps.withpag = 'Y' AND a.totalgross > 1000 THEN 200 ELSE 0 END
        FROM payroll_summary ps
        JOIN #Agg a ON ps.employee_id = a.employee_id
        WHERE ps.idclientp = @idclient
        AND ps.Date_Start = @PayrollPeriodStart;


        /* =========================================
           STEP 7: OTHER DEDUCTIONS
        ========================================= */
        UPDATE ps
        SET 
            Other_Deduction = od.totalamount,
            Other_Deduction2 = od.totalamount2
        FROM payroll_summary ps
        JOIN (
            SELECT 
                idpayrollsum,
                SUM(amount) totalamount,
                SUM(amount2) totalamount2
            FROM otherdeduction
            GROUP BY idpayrollsum
        ) od ON ps.idpayrollsum = od.idpayrollsum;


        /* =========================================
           STEP 8: TAX
        ========================================= */
        UPDATE ps
        SET Wtax = 
            CASE 
                WHEN @idclient IN (171,173,74) THEN taxcalc.tax
                WHEN @idclient = 105 AND ps.idbranchpositionp IN (5723,5726,5659,5736,5622)
                    THEN taxcalc.tax
                ELSE 0
            END
        FROM payroll_summary ps
        CROSS APPLY (
            SELECT TOP 1 
                ((ps.grossalary 
                - (ISNULL(ps.contributionSSSEE,0)
                + ISNULL(ps.contributionphilhealthEE,0)
                + ISNULL(ps.contributionPagibigEE,0)
                + ISNULL(ps.contributionSSSEEpro,0)))
                * t.Percentage) + t.PrescribeTax AS tax
            FROM TAXTABLENEW t
            WHERE t.Term = 'Semi-Monthly'
            AND t.Range1 <= ps.grossalary
            ORDER BY t.Range1 DESC
        ) taxcalc
        WHERE ps.idclientp = @idclient
        AND ps.Date_Start = @PayrollPeriodStart;


        /* =========================================
           STEP 9: FINAL COMPUTATION
        ========================================= */
        UPDATE payroll_summary
        SET 
            Totaldeduction =
                ISNULL(contributionSSSEE,0)
                + ISNULL(contributionphilhealthEE,0)
                + ISNULL(contributionPagibigEE,0)
                + ISNULL(Wtax,0)
                + ISNULL(Other_Deduction,0),

            netamount =
                grossalary - (
                ISNULL(contributionSSSEE,0)
                + ISNULL(contributionphilhealthEE,0)
                + ISNULL(contributionPagibigEE,0)
                + ISNULL(Wtax,0)
                + ISNULL(Other_Deduction,0)
                ),

            netamount2 =
                grossalary - (
                ISNULL(contributionSSSEE,0)
                + ISNULL(contributionphilhealthEE,0)
                + ISNULL(contributionPagibigEE,0)
                + ISNULL(Wtax,0)
                + ISNULL(Other_Deduction,0)
                ) + ISNULL(Other_Deduction2,0)
        WHERE idclientp = @idclient
        AND Date_Start = @PayrollPeriodStart;


        COMMIT TRANSACTION;
    END TRY

    BEGIN CATCH
        ROLLBACK TRANSACTION;

        DECLARE @ErrorMessage NVARCHAR(MAX) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH

END