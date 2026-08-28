-- =============================================
-- Author:		Pats Relos
-- Create date: <10-28-2023>
-- Description:	<Payroll Summary Per Client>
-- =============================================
CREATE PROCEDURE [dbo].[usp_thirteenmonthsummaryperclient]

@idclient integer,
@thirteenmonthyear nvarchar(20)

AS	

BEGIN
--SET @paradatestart = CONVERT(DATE, @paradatestart, 101) 
--SET @paradatestart = '2023-04-01'

	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;


CREATE TABLE #TempTable2 (
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
    [Companyname] NVARCHAR(100),
	[tbasic] FLOAT,
    [thirteenmonth] FLOAT,
	[thirteenmonthytd] FLOAT,
	[thirteenmonthyear] int,
	[payout] NVARCHAR(20),
	[payoutsort] int
   
);

-- Insert data from the payroll_summary table into the #TempTable
--DECLARE @payrollyear VARCHAR(20) = 'June 2023'
--DECLARE @idclient VARCHAR(8) = 'Active'

CREATE INDEX idx_companyname ON #TempTable2 (Companyname);
IF (@idclient IS NULL OR @idclient = -1) 
begin
INSERT INTO #TempTable2 (Companyname,tbasic, thirteenmonth, thirteenmonthyear,payout,payoutsort)
		SELECT
		Viewthirteenmonthsummaryperclient.companyname,
		SUM(Viewthirteenmonthsummaryperclient.basic) AS totalbasic,
		SUM(Viewthirteenmonthsummaryperclient.basic)/12 AS thirteenmonth,
		SUM(Viewthirteenmonthsummaryperclient.thirteenmonthyear) AS thirteenmonthyear,
		Viewthirteenmonthsummaryperclient.payout,
		Viewthirteenmonthsummaryperclient.payoutsort
		FROM
		Viewthirteenmonthsummaryperclient
	
		WHERE
		(Viewthirteenmonthsummaryperclient.thirteenmonthyear = @thirteenmonthyear)
		
		GROUP BY
		Viewthirteenmonthsummaryperclient.companyname,Viewthirteenmonthsummaryperclient.payout,Viewthirteenmonthsummaryperclient.payoutsort;
		
End
else
begin
		INSERT INTO #TempTable2 (Companyname,tbasic, thirteenmonth, thirteenmonthyear,payout,payoutsort)
		SELECT
		Viewthirteenmonthsummaryperclient.companyname,
		SUM(Viewthirteenmonthsummaryperclient.basic) AS totalbasic,
		SUM(Viewthirteenmonthsummaryperclient.basic)/12 AS thirteenmonth,
		SUM(Viewthirteenmonthsummaryperclient.thirteenmonthyear) AS thirteenmonthyear,
		Viewthirteenmonthsummaryperclient.payout,
		Viewthirteenmonthsummaryperclient.payoutsort
		FROM
		Viewthirteenmonthsummaryperclient
	
		WHERE
		(Viewthirteenmonthsummaryperclient.thirteenmonthyear = @thirteenmonthyear) AND (Viewthirteenmonthsummaryperclient.idclientp = @idclient)
		
		GROUP BY
		Viewthirteenmonthsummaryperclient.companyname,Viewthirteenmonthsummaryperclient.payout,Viewthirteenmonthsummaryperclient.payoutsort;
		


End 






-- Retrieve data from #TempTable
SELECT * FROM #TempTable2 order by Companyname;

-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTable2;

END

