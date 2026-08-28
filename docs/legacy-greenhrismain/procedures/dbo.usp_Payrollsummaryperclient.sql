-- =============================================
-- Author:		Pats Relos
-- Create date: <7-30-2023>
-- Description:	<Payroll Summary Per Client>
-- =============================================
CREATE PROCEDURE [dbo].[usp_Payrollsummaryperclient]
--@paraidclientp int,
--@paraiddepart nchar(10)
--@paradatestart date
--@uname varchar(20), 
--@datestart date
@payrollmonth varchar(20),
@clientstatus varchar(8)

AS	

BEGIN
--SET @paradatestart = CONVERT(DATE, @paradatestart, 101) 
--SET @paradatestart = '2023-04-01'

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;


CREATE TABLE #TempTable (
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
    [Companyname] NVARCHAR(100),
    [Salaries] FLOAT,
    [wtax] FLOAT,
    [sssloan] FLOAT,
    [pagibigloan] FLOAT,
    [otherdeduction] FLOAT,
    [sssee] FLOAT,
    [phiee] FLOAT,
    [pagee] FLOAT,
    [ssser] FLOAT,
    [phier] FLOAT,
    [pager] FLOAT,
    [ecc] FLOAT,
    [thirteenmonth] FLOAT,
    [thirteenmonthytd] FLOAT,
    [SIL] FLOAT
);

-- Insert data from the payroll_summary table into the #TempTable
--DECLARE @payrollmonth VARCHAR(20) = 'June 2023'
--DECLARE @clientstatus VARCHAR(8) = 'Active'

CREATE INDEX idx_companyname ON #TempTable (Companyname);

INSERT INTO #TempTable (Companyname, Salaries, wtax, sssee, phiee, pagee, ssser, phier, pager, ecc, thirteenmonth, thirteenmonthytd, SIL)
--SELECT
--   client.companyname,
--    SUM(payroll_summary.grossalary) AS Salaries,
--    SUM(payroll_summary.Wtax) AS wtax,
--    SUM(payroll_summary.contributionSSSEE) AS sssee,
--   SUM(payroll_summary.contributionphilhealthEE) AS phiee,
--    SUM(payroll_summary.contributionPagibigEE) AS pagee,
--    SUM(payroll_summary.contributionSSSER) AS ssser,
--    SUM(payroll_summary.contributionphilhealthER) AS phier,
--    SUM(payroll_summary.contributionPagibigER) AS pager,
--    SUM(payroll_summary.contributionSSSECC) AS ecc,
--    SUM(payroll_summary.thirteenmonth) AS thirteenmonth,
--    SUM(payroll_summary.thirteenmonthyear) AS thirteenmonthytd,
--    SUM(payroll_summary.silp) AS SIL
--FROM
--    payroll_summary
--INNER JOIN
--    client ON payroll_summary.idclientp = client.idclient
--WHERE
--    (payroll_summary.payrollmonth = @payrollmonth) AND (client.clientstatus = @clientstatus)
--GROUP BY
--    client.companyname;

SELECT
	payrollclientpermonth.companyname,
    SUM(payrollclientpermonth.grossalary) AS Salaries,
    SUM(payrollclientpermonth.Wtax) AS wtax,
    SUM(payrollclientpermonth.contributionSSSEE) AS sssee,
	SUM(payrollclientpermonth.contributionphilhealthEE) AS phiee,
    SUM(payrollclientpermonth.contributionPagibigEE) AS pagee,
    SUM(payrollclientpermonth.contributionSSSER) AS ssser,
    SUM(payrollclientpermonth.contributionphilhealthER) AS phier,
    SUM(payrollclientpermonth.contributionPagibigER) AS pager,
    SUM(payrollclientpermonth.contributionSSSECC) AS ecc,
    SUM(payrollclientpermonth.thirteenmonth) AS thirteenmonth,
    SUM(payrollclientpermonth.thirteenmonthyear) AS thirteenmonthytd,
    SUM(payrollclientpermonth.silp) AS SIL
FROM
    payrollclientpermonth
WHERE
    (payrollclientpermonth.payoutmonth = @payrollmonth) AND (payrollclientpermonth.clientstatus = @clientstatus)

GROUP BY
    payrollclientpermonth.companyname;

	







--SSS loan 
INSERT INTO [#TempTable]
                         (Companyname, sssloan)
SELECT DISTINCT client.companyname, SUM(otherdeduction.amount) AS pagibigloan1
FROM            payroll_summary INNER JOIN
                         otherdeduction ON payroll_summary.idpayrollsum = otherdeduction.idpayrollsum INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient
WHERE        (otherdeduction.particular = N'SSS Loan') AND (payroll_summary.payrollmonth = @payrollmonth) AND (client.clientstatus = @clientstatus)
GROUP BY client.companyname


--pag-ibig loan 
INSERT INTO [#TempTable]
                         (Companyname, pagibigloan)
SELECT DISTINCT client.companyname, SUM(otherdeduction.amount) AS pagibigloan1
FROM            payroll_summary INNER JOIN
                         otherdeduction ON payroll_summary.idpayrollsum = otherdeduction.idpayrollsum INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient
WHERE        (otherdeduction.particular = N'Pag-ibig Loan') AND (payroll_summary.payrollmonth = @payrollmonth) AND (client.clientstatus = @clientstatus)
GROUP BY client.companyname


--Other Deduction
INSERT INTO [#TempTable]
(Companyname, otherdeduction)
SELECT DISTINCT client.companyname, SUM(otherdeduction.amount) AS Otherduduction
FROM            payroll_summary INNER JOIN
                         otherdeduction ON payroll_summary.idpayrollsum = otherdeduction.idpayrollsum INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient
WHERE        (otherdeduction.particular <> N'Pag-ibig Loan') AND (otherdeduction.particular <> N'SSS Loan') AND (payroll_summary.payrollmonth = @payrollmonth) AND (client.clientstatus = @clientstatus)
GROUP BY client.companyname




-- Retrieve data from #TempTable
SELECT * FROM #TempTable order by Companyname;

-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTable;

END

