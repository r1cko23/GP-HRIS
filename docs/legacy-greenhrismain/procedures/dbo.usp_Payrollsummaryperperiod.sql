-- =============================================
-- Author:		Pats Relos
-- Create date: <7-30-2023>
-- Description:	<Payroll Summary Per Client>
-- =============================================
CREATE PROCEDURE [dbo].[usp_Payrollsummaryperperiod]
@payrollmonth varchar(20),
@clientstatus varchar(8),
@dstart date,
@dend date

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
	[idclient] int,
	[Headcount] int,
	[Manhours] float,
	[Salaries] FLOAT,
	[thirteenmonth] FLOAT,
	[SIL] FLOAT,
	[sssee] FLOAT,
    [phiee] FLOAT,
    [pagee] FLOAT,
    [wtax] FLOAT,
    [sssloan] FLOAT DEFAULT 0,
    [pagibigloan] FLOAT DEFAULT 0,
    [otherdeduction] FLOAT DEFAULT 0,   
    [ssser] FLOAT,
    [phier] FLOAT,
    [pager] FLOAT,
    [ecc] FLOAT,  
	[sssproer] FLOAT,  
    [thirteenmonthytd] FLOAT,
	dstart date,
	dend date
    
);

-- Insert data from the payroll_summary table into the #TempTable
--DECLARE @payrollmonth VARCHAR(20) = 'June 2023'
--DECLARE @clientstatus VARCHAR(8) = 'Active'

CREATE INDEX idx_companyname ON #TempTable (Companyname);



INSERT INTO #TempTable (Companyname,Headcount,[Manhours],[Salaries],thirteenmonth,SIL,sssee, phiee, pagee,  wtax , ssser, phier, pager, ecc,sssproer, thirteenmonthytd)

SELECT
ViewPayrollSummaryperiod.companyname,
COUNT(DISTINCT Employee_id) AS headcount,
SUM(ViewPayrollSummaryperiod.noofhourswork) AS manhours,
SUM(ViewPayrollSummaryperiod.grossalary) AS Salaries,
SUM(ViewPayrollSummaryperiod.thirteenmonth) AS thirteenmonth,
SUM(ViewPayrollSummaryperiod.silp) AS SIL,
SUM(ViewPayrollSummaryperiod.contributionSSSEE) AS sssee,
SUM(ViewPayrollSummaryperiod.contributionphilhealthEE) AS phiee,
SUM(ViewPayrollSummaryperiod.contributionPagibigEE) AS pagee,
SUM(ViewPayrollSummaryperiod.Wtax) AS wtax,
SUM(ViewPayrollSummaryperiod.contributionSSSER) AS ssser,
SUM(ViewPayrollSummaryperiod.contributionphilhealthER) AS phier,
SUM(ViewPayrollSummaryperiod.contributionPagibigER) AS pager,
SUM(ViewPayrollSummaryperiod.contributionSSSECC) AS ecc,
SUM(ViewPayrollSummaryperiod.contributionSSSERpro) AS sssproer,
SUM(ViewPayrollSummaryperiod.thirteenmonthyear) AS thirteenmonthytd

FROM
    ViewPayrollSummaryperiod
WHERE
    (ViewPayrollSummaryperiod.date_start >= @dstart and ViewPayrollSummaryperiod.date_end <= @dend)

GROUP BY
    ViewPayrollSummaryperiod.companyname






--SSS loan 
INSERT INTO [#TempTable]
                         (Companyname, sssloan)
SELECT DISTINCT client.companyname, SUM(otherdeduction.amount) AS sssloan
FROM            payroll_summary INNER JOIN
                         otherdeduction ON payroll_summary.idpayrollsum = otherdeduction.idpayrollsum INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient
WHERE        (otherdeduction.particular = N'SSS Loan') AND (payroll_summary.Date_Start >= @dstart and payroll_summary.Date_Start <= @dend )
GROUP BY client.companyname


--pag-ibig loan 
INSERT INTO [#TempTable]
                         (Companyname, pagibigloan)
SELECT DISTINCT client.companyname, SUM(otherdeduction.amount) AS pagibigloan1
FROM            payroll_summary INNER JOIN
                         otherdeduction ON payroll_summary.idpayrollsum = otherdeduction.idpayrollsum INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient
WHERE        (otherdeduction.particular = N'Pag-ibig Loan') AND (payroll_summary.Date_Start >= @dstart and payroll_summary.Date_Start <= @dend )
GROUP BY client.companyname


--Other Deduction
INSERT INTO [#TempTable]
(Companyname, otherdeduction)
SELECT DISTINCT client.companyname, SUM(otherdeduction.amount) AS Otherduduction
FROM            payroll_summary INNER JOIN
                         otherdeduction ON payroll_summary.idpayrollsum = otherdeduction.idpayrollsum INNER JOIN
                         client ON payroll_summary.idclientp = client.idclient
WHERE        (otherdeduction.particular <> N'Pag-ibig Loan') AND (otherdeduction.particular <> N'SSS Loan') AND (payroll_summary.Date_Start >= @dstart and payroll_summary.Date_Start <= @dend )
GROUP BY client.companyname




-- Retrieve data from #TempTable
--SELECT * FROM #TempTable order by Companyname;


SELECT        Companyname, 
							SUM(Headcount) AS headcountx, 
							SUM(Manhours) AS Manhoursx, 
							SUM(Salaries) AS Salariesx, 
							SUM(thirteenmonth) AS thirteenmonthx, 
							SUM([SIL]) AS silx, 
							SUM(sssee) AS ssseex, 
							SUM(phiee) AS phieex, 
							SUM(pagee) AS pageex,
							SUM(wtax) AS wtaxx,
							SUM(sssloan) AS sssloanx,
							SUM(pagibigloan) AS pagibigloanx,
							SUM(otherdeduction) AS otherdeductionx,
							SUM(ssser) AS ssserx,
							SUM(ecc) AS eccx,
							SUM(sssproer) AS sssproerx,
							SUM(phier) AS phierx,
							SUM(pager) AS pagerx


FROM #TempTable
GROUP BY Companyname


-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTable;

END

