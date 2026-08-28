
CREATE PROCEDURE [dbo].[42bf00bd-6230-462f-a118-a3d93166c3b9V230INDWEEKLYOTHERDEDANDNETYMASS]

    @idclient INT,
    @PayrollPeriodStart DATE,
    @idpayroll INT,
    @idemployee INT

AS
BEGIN
    SET NOCOUNT ON;

    -------------------------------------------------------------------------
    -- Update idpayrollsum in Other Deduction
    -------------------------------------------------------------------------

    ;WITH PayrollCTE AS
    (
        SELECT
            Employee_id,
            idpayrollsum,
            ROW_NUMBER() OVER
            (
                PARTITION BY Employee_id
                ORDER BY grossalary DESC
            ) AS rn
        FROM payroll_summary
       WHERE idclientp=@idclient
        AND Date_Start=@PayrollPeriodStart
        AND Employee_id=@idemployee
    )

    UPDATE OD  WITH (UPDLOCK, ROWLOCK)
       SET idpayrollsum=P.idpayrollsum
    FROM otherdeduction OD
    INNER JOIN PayrollCTE P
        ON OD.employee_id=P.Employee_id
       AND P.rn=1
    WHERE OD.idclientdeduction=@idclient
      AND OD.Date_Start=@PayrollPeriodStart;



    -------------------------------------------------------------------------
    -- Compute Total Other Deduction
    -------------------------------------------------------------------------

    ;WITH DeductionTotal AS
    (
        SELECT
            idpayrollsum,
            SUM(ISNULL(amount,0))  AS OtherDeduction,
            SUM(ISNULL(amount2,0)) AS OtherDeduction2
        FROM otherdeduction
        GROUP BY idpayrollsum
    )

    UPDATE PS
       SET
            Other_Deduction = ISNULL(D.OtherDeduction,0),
            Other_Deduction2 = ISNULL(D.OtherDeduction2,0)
    FROM payroll_summary PS
    LEFT JOIN DeductionTotal D
           ON PS.idpayrollsum=D.idpayrollsum
    WHERE PS.idclientp=@idclient
      AND PS.Date_Start=@PayrollPeriodStart;



    -------------------------------------------------------------------------
    -- Compute Total Deduction / Net Amount
    -------------------------------------------------------------------------

    UPDATE payroll_summary
       SET

        TotalDeduction=

            ISNULL(contributionSSSEE,0)
          + ISNULL(contributionSSSEEpro,0)
          + ISNULL(contributionphilhealthEE,0)
          + ISNULL(contributionpagibigEE,0)
          + ISNULL(wtax,0)
          + ISNULL(Other_Deduction,0),


        NetAmount=

            ROUND
            (
                CAST(ISNULL(grossalary,0) AS DECIMAL(18,2))
              -
                CAST
                (
                    ISNULL(contributionSSSEE,0)
                  + ISNULL(contributionSSSEEpro,0)
                  + ISNULL(contributionphilhealthEE,0)
                  + ISNULL(contributionpagibigEE,0)
                  + ISNULL(wtax,0)
                  + ISNULL(Other_Deduction,0)
                AS DECIMAL(18,2))
            ,2),

        NetAmount2=

            ISNULL(grossalary,0)

          -

            (
                ISNULL(contributionSSSEE,0)
              + ISNULL(contributionSSSEEpro,0)
              + ISNULL(contributionphilhealthEE,0)
              + ISNULL(contributionpagibigEE,0)
              + ISNULL(wtax,0)
              + ISNULL(Other_Deduction,0)
            )

          + ISNULL(Other_Deduction2,0)

    WHERE idclientp=@idclient
      AND Date_Start=@PayrollPeriodStart
      AND idpayrollsum = @idpayroll



END
